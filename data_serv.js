const dns = require('dns');
dns.setDefaultResultOrder('ipv4first'); // Prioritize IPv4 to resolve connection timeout issues in some environments

const express = require('express');
const morgan = require('morgan');
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mdb = require('./mongooseDB');
const liveDatas = require('./scripts/liveData.js');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const { MongoMemoryServer } = require('mongodb-memory-server');
const pjson = require('./package.json');
const { log } = require('./utils/logger');
const { attachUser } = require('./utils/auth');
const { GeneralError } = require('./utils/errors');
const config = require('./config/config');
const createUserModel = require('./models/userModel');

const IN_PROD = config.env === 'production';

async function createApp() {
    const app = express();
    app.set('trust proxy', 1);

    app.locals.appVersion = pjson.version;

    app.use(express.static(path.join(__dirname, 'public')));
    app.use(morgan('dev'));

    const corsOptions = {
        origin: (origin, callback) => {
            if (!IN_PROD) {
                return callback(null, true);
            }
            const whitelist = (process.env.CORS_WHITELIST || '').split(',');
            if (whitelist.includes(origin) || !origin) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        optionsSuccessStatus: 200
    };

    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    app.use(express.json({ limit: '10mb' }));

    try {
        log("Initializing mongodb connections...");
        const dbConnection = await mdb.init();
        
        log("Assigning dbs to app.locals...");
        app.locals.dbs = {};
        for (const dbName of config.db.appDbNames) {
            app.locals.dbs[dbName] = dbConnection.getDb(dbName);
        }
        log("DBs assigned.");

        // Initialize and attach models to app.locals
        app.locals.models = {
            User: createUserModel(dbConnection.mongooseConnection)
        };
        log("Models initialized and attached to app.locals.");

        if (config.env !== 'test') {
            liveDatas.init(app.locals.dbs.datas);
            log("LiveData - v" + liveDatas.version);
        }

        const mongoStore = new MongoDBStore({
            uri: dbConnection.getMongoUrl(),
            collection: 'mySessions',
            client: dbConnection.client,
        });
        mongoStore.on('error', (error) => log(`MongoStore Error: ${error}`, 'error'));

        const sessionOptions = {
            name: config.session.name,
            resave: false,
            saveUninitialized: false,
            secret: config.session.secret,
            store: mongoStore,
            cookie: {
                secure: IN_PROD,
                httpOnly: true,
                sameSite: 'lax',
                maxAge: config.session.maxAge,
            }
        };
        if (config.session.cookie_domain) {
            sessionOptions.cookie.domain = config.session.cookie_domain;
        }

        const apiLimiter = rateLimit({ ...config.rateLimit, standardHeaders: true, legacyHeaders: false });
        app.use('/api/', apiLimiter);
        app.use('/api/v1', cors(corsOptions), require("./routes/api.routes"));

        const webRouter = express.Router();
        webRouter.use(session(sessionOptions));
        webRouter.use(attachUser);
        webRouter.use('/', require("./routes/auth.routes"));
        webRouter.use('/', require("./routes/web.routes"));
        app.use('/', webRouter);

        app.use((err, req, res, next) => {
            if (res.headersSent) {
                return next(err);
            }
            if (err.name === 'CastError') {
                return res.status(400).json({ status: 'error', message: 'Invalid ID format.' });
            }
            if (err instanceof GeneralError) {
                const responseJson = { status: 'error', message: err.message };
                if (err.errors) {
                    responseJson.errors = err.errors;
                }
                return res.status(err.getCode()).json(responseJson);
            }
            log(err.stack, 'error');
            return res.status(500).json({ status: 'error', message: 'An internal server error occurred.' });
        });

        return { app, dbConnection, mongoStore };

    } catch (err) {
        log(`Failed to initialize application: ${err}`, 'error');
        throw err; // Re-throw error to be caught by caller
    }
}

if (require.main === module) {
    createApp().then(({ app }) => {
        app.listen(config.server.port, () => {
            log(`\n\nData API Server running at port ${config.server.port}`);
        });
    }).catch(err => {
        log(`Failed to start server: ${err}`, 'error');
        process.exit(1);
    });
}

module.exports = createApp;