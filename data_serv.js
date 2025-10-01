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

const IN_PROD = config.env === 'production';

const app = express();
app.set('trust proxy', 1) // trust first proxy

// Make version available in all templates
app.locals.appVersion = pjson.version;


// Middlewares & routes
app.use(express.static(path.join(__dirname, 'public')));
app.use(morgan('dev'));
// Configure CORS to be more restrictive in production
const corsOptions = {
    origin: (origin, callback) => {
        // In development, allow all origins for ease of testing.
        if (!IN_PROD) {
            return callback(null, true);
        }

        // In production, only allow requests from a specific whitelist of origins.
        const whitelist = (process.env.CORS_WHITELIST || '').split(',');

        // Allow requests from whitelisted origins or requests with no origin (e.g., Postman).
        let allowed = false;
        if (whitelist.includes(origin) || !origin) {
            allowed = true;
        } else if (origin) {
            // Also allow localhost origins for local production testing.
            try {
                const originUrl = new URL(origin);
                if (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1') {
                    allowed = true;
                }
            } catch (e) {
                // Malformed origin, ignore.
            }
        }

        if (allowed) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true, // This is important for sessions/cookies.
    optionsSuccessStatus: 200
};
// CORS middleware is now applied directly to API routes.
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));



async function startServer() {

    try {
        log("Initializing mongodb connections..."); 
        const dbConnection = await mdb.init();
        
        try {
            log("Assigning dbs to app.locals...");
            app.locals.dbs = {};
            for (const dbName of config.db.appDbNames) {
                app.locals.dbs[dbName] = dbConnection.getDb(dbName);
            }
            log("DBs assigned.");

            // Insert boot log
            const userLogsCollection = app.locals.dbs[config.db.appDbNames[0]].collection('userLogs');

            await userLogsCollection.insertOne({
                logType: 'boot',
                client: 'server',
                content: 'dbServer boot',
                authorization: 'none',
                host: config.env === 'production' ? "Production Mode" : "Development Mode",
                ip: 'localhost',
                hitCount: 'N/A',
                created: new Date()
            });
            log("Boot log inserted.");

 
            // Fetch and log collection info for all dbs
            app.locals.collectionInfo = [];

            for (const dbName in app.locals.dbs) {
                const db = app.locals.dbs[dbName];
                if (db) {
                    const collections = await db.listCollections().toArray();
                    for (const coll of collections) {
                        const count = await db.collection(coll.name).countDocuments();
                        app.locals.collectionInfo.push({  db: dbName,  collection: coll.name, count: count });
                    }
                }
            }
            log(`Collection Info for all dbs has been gathered. \n__________________________________________________\n\n`);

        } catch (e) {            log(`Could not initialize dbs on startup: ${e.message}`, 'warn');        }

 

        let mongoStore = new MongoDBStore({  uri: dbConnection.getMongoUrl(), collection: 'mySessions',  client: dbConnection.client    });
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
                sameSite: IN_PROD ? 'none' : 'lax',
                maxAge: config.session.maxAge,
            }
        };


          
        // Apply rate limiting and API routes
        const apiLimiter = rateLimit({ ...config.rateLimit, standardHeaders: true, legacyHeaders: false   });
        app.use('/api/', apiLimiter);
        // Apply CORS middleware only to API routes
        app.use('/api/v1', cors(corsOptions), require("./routes/api.routes")); // API routes don't use session middleware
        // Create a dedicated router for web routes that require session handling
        const webRouter = express.Router();
        webRouter.use(session(sessionOptions));
        webRouter.use(attachUser); // Apply attachUser middleware only to web routes
        webRouter.use('/', require("./routes/auth.routes"));
        webRouter.use('/', require("./routes/web.routes"));
        app.use('/', webRouter); // Mount the web router


        // Global error handler should be last
        app.use((err, req, res, next) => {

            if (res.headersSent) {     return next(err);    }

            // Handle Mongoose CastError (e.g., for malformed IDs)
            if (err.name === 'CastError') {
                return res.status(400).json({  status: 'error',  message: 'Invalid ID format.'    });
            }

            if (err instanceof GeneralError) {
                const responseJson = { status: 'error', message: err.message };
                if (err.errors) {     responseJson.errors = err.errors;       }
                return res.status(err.getCode()).json(responseJson);
            }

            log(err.stack, 'error');

            return res.status(500).json({ status: 'error', message: 'An internal server error occurred.' });
        });

 

        // Initialize LiveData (MQTT client, etc.)
        // The liveData module itself prevents intervals from running in test mode.
        liveDatas.init(app.locals.dbs);
        log("LiveData  -  v" + liveDatas.version);

        let server;

        if (config.env !== 'test') {
            server = app.listen(config.server.port, () => {
                log(`\n\nData API Server running at port ${config.server.port}`);
            });
        }

 

        const closeServer = async () => {
            if (server) {
                await new Promise(resolve => server.close(resolve));
                log('Server closed.');
            }
            await liveDatas.close();
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
if (require.main === module) {  startServer();  }

module.exports = startServer;