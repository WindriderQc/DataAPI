require('dotenv').config();
const express = require('express');
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


const PORT = process.env.PORT || 3003;
const IN_PROD = process.env.NODE_ENV === 'production'  // for https channel...  IN_PROD will be true if in production environment    If true while on http connection, session cookie will not work
const dbCollectionName = process.env.NODE_ENV === 'production' ? 'datas' : 'devdatas';


const { attachUser } = require('./utils/auth');

const app = express();
app.set('trust proxy', 1) // trust first proxy

// Make version available in all templates
app.locals.appVersion = pjson.version;

// Middlewares & routes
app.use(cors({ origin: '*', optionsSuccessStatus: 200 }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));


const { GeneralError } = require('./utils/errors');

// Global error handler middleware
app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    if (err instanceof GeneralError) {
        const responseJson = {
            status: 'error',
            message: err.message
        };
        if (err.errors) {
            responseJson.errors = err.errors;
        }
        return res.status(err.getCode()).json(responseJson);
    }

    log(err.stack, 'error');
    return res.status(500).json({
        status: 'error',
        message: 'An internal server error occurred.'
    });
});

async function startServer() {
    try {
        const dbConnection = await mdb.init();
        let mongoStore;


        // Initialize database connections
        try {
            log("Assigning dbs to app.locals...");
            const dbNames = ['SBQC', 'datas'];
            app.locals.dbs = {};
            for (const dbName of dbNames) {
                app.locals.dbs[dbName] = dbConnection.getDb(dbName);
            }
            log("DBs assigned.");

            // Insert boot log
            const userLogsCollection = app.locals.dbs['SBQC'].collection('userLogs');
            await userLogsCollection.insertOne({
                logType: 'boot',
                client: 'server',
                content: 'dbServer boot',
                authorization: 'none',
                host: IN_PROD ? "Production Mode" : "Developpement Mode",
                ip: 'localhost',
                hitCount: 'N/A',
                created: new Date()
            });
            log("Boot log inserted.");

            // Fetch and log collection info for the 'datas' db
            app.locals.collectionInfo = {};
            const datasDb = app.locals.dbs['datas'];
            const collections = await datasDb.listCollections().toArray();
            for (const coll of collections) {
                const count = await datasDb.collection(coll.name).countDocuments();
                app.locals.collectionInfo[coll.name] = count;
            }
            log(`Collection Info for 'datas' db has been gathered. \n__________________________________________________\n\n`);


        } catch (e) {
            log(`Could not initialize dbs on startup: ${e.message}`, 'warn');
        }

        mongoStore = new MongoDBStore({
            uri: dbConnection.getMongoUrl(),
            collection: 'mySessions',
            client: dbConnection.client
        });
        mongoStore.on('error', (error) => log(`MongoStore Error: ${error}`, 'error'));

        const sessionOptions = {
            name: process.env.SESS_NAME,
            resave: false,
            saveUninitialized: false,
            secret: process.env.SESS_SECRET,
            store: mongoStore,
            cookie: {
                secure: IN_PROD,
                httpOnly: true,
                sameSite: 'none',
                maxAge: 1000 * 60 * 60
            }
        };

        // Apply rate limiting and API routes
        const apiLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100,
            standardHeaders: true,
            legacyHeaders: false,
        });
        app.use('/api/', apiLimiter);
        app.use('/api/v1', require("./routes/api.routes")); // API routes don't use session middleware

        // Create a dedicated router for web routes that require session handling
        const webRouter = express.Router();
        // Set a dummy secret for the test environment
        if (process.env.NODE_ENV === 'test') {
            sessionOptions.secret = 'test-secret';
        }
        webRouter.use(session(sessionOptions));
        webRouter.use(attachUser); // Apply attachUser middleware only to web routes
        webRouter.use('/', require("./routes/auth.routes"));
        webRouter.use('/', require("./routes/web.routes"));
        app.use('/', webRouter); // Mount the web router

        // Global error handler should be last
        app.use((err, req, res, next) => {
            if (res.headersSent) {
                return next(err);
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

        let server;
        if (process.env.NODE_ENV !== 'test') {
            server = app.listen(PORT, () => {
                log(`\n\nData API Server running at port ${PORT}`);
                liveDatas.init(app.locals.dbs);
                log("LiveData  -  v" + liveDatas.version);
            });
        }

        const closeServer = async () => {
            if (server) {
                await new Promise(resolve => server.close(resolve));
                log('Server closed.');
            }
            liveDatas.close();
            await dbConnection.close();
        };

        return { app, close: closeServer, dbConnection };

    } catch (err) {
        log(`Failed to initialize database: ${err}`, 'error');
        if (process.env.NODE_ENV !== 'test') {
            process.exit(1);
        } else {
            throw err;
        }
    }
}

// Start the server only if the file is run directly
if (require.main === module) {
    startServer();
}

module.exports = startServer;