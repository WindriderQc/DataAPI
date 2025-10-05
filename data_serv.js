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

const app = express();
app.set('trust proxy', 1);

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



async function createApp() {
    // Quick startup disk-space checks to fail fast on low-disk machines.
    // Defaults are conservative for production but permissive for tests.
    const { execSync } = require('child_process');
    function getAvailableKB(path) {
        try {
            const out = execSync(`df -k ${path}`).toString();
            const lines = out.trim().split(/\r?\n/);
            if (lines.length < 2) return null;
            const parts = lines[lines.length - 1].split(/\s+/);
            // Filesystem 1K-blocks Used Available Use% Mounted on
            const availKB = parseInt(parts[3], 10);
            return Number.isFinite(availKB) ? availKB : null;
        } catch (e) {
            log(`Could not determine disk free space for ${path}: ${e.message}`, 'warn');
            return null;
        }
    }

    function ensureFreeSpace() {
        const env = config.env || process.env.NODE_ENV || 'development';
        const defaultRootMB = env === 'test' ? 10 : parseInt(process.env.MIN_FREE_SPACE_MB || '1024', 10); // MB
        const defaultTmpMB = env === 'test' ? 5 : parseInt(process.env.MIN_FREE_SPACE_TMP_MB || '512', 10); // MB

        const rootAvailKB = getAvailableKB('/');
        const tmpAvailKB = getAvailableKB('/tmp');

        if (rootAvailKB !== null) {
            const rootAvailMB = Math.floor(rootAvailKB / 1024);
            if (rootAvailMB < defaultRootMB) {
                throw new Error(`Insufficient free space on /: ${rootAvailMB} MB available, require at least ${defaultRootMB} MB`);
            }
        }
        if (tmpAvailKB !== null) {
            const tmpAvailMB = Math.floor(tmpAvailKB / 1024);
            if (tmpAvailMB < defaultTmpMB) {
                throw new Error(`Insufficient free space on /tmp: ${tmpAvailMB} MB available, require at least ${defaultTmpMB} MB`);
            }
        }
    }

    try {
        ensureFreeSpace();
    } catch (err) {
        log(`Startup aborted by disk-space check: ${err.message}`, 'error');
        throw err;
    }

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
        if (config.env !== 'test') {
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
        }

        // Fetch and log collection info for all dbs
        app.locals.collectionInfo = [];
        for (const dbName in app.locals.dbs) {
            const db = app.locals.dbs[dbName];
            if (db) {
                const collections = await db.listCollections().toArray();
                for (const coll of collections) {
                    const count = await db.collection(coll.name).countDocuments();
                    app.locals.collectionInfo.push({ db: dbName, collection: coll.name, count: count });
                }
            }
        }
        log(`Collection Info for all dbs has been gathered.`);

        // Initialize and attach models to app.locals
        app.locals.models = {
            User: createUserModel(dbConnection.mongooseConnection)
        };
        log("Models initialized and attached to app.locals.");

    } catch (e) {
        log(`Could not initialize dbs on startup: ${e.message}`, 'warn');
    }

    if (config.env !== 'test') {
        liveDatas.init(app.locals.dbs.datas);
        log("LiveData  -  v" + liveDatas.version);
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


    let server;
    const close = async () => {
        if (server) {
            await new Promise(resolve => server.close(resolve));
            log('Server closed.');
        }
        await dbConnection.close();
        await mdb.closeServer();
        await liveDatas.close();
        mongoStore.client.close();
    };

    if (require.main === module) {
        const pidFile = process.env.DATA_API_PID_FILE || '/tmp/data-api-server.pid';

        const writePidFile = () => {
            try {
                require('fs').writeFileSync(pidFile, String(process.pid), { flag: 'w', mode: 0o644 });
                log(`Wrote pid file ${pidFile}`);
            } catch (e) {
                log(`Could not write pid file ${pidFile}: ${e.message}`, 'warn');
            }
        };

        const removePidFile = () => {
            try {
                const fs = require('fs');
                if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
                log(`Removed pid file ${pidFile}`);
            } catch (e) {
                // non-fatal
            }
        };

        const startServer = (port) => {
            server = app.listen(port, () => {
                log(`\n\nData API Server running at port ${port}`);
            });

            server.on('error', (err) => {
                if (err && err.code === 'EADDRINUSE') {
                    log(`Port ${port} is already in use.`, 'error');
                    // If the env allows fallback, try next port once
                    const allowFallback = process.env.ALLOW_PORT_FALLBACK === 'true';
                    const fallbackPort = parseInt(process.env.PORT_FALLBACK || (port + 1), 10);
                    if (allowFallback && fallbackPort !== port) {
                        log(`Attempting to start on fallback port ${fallbackPort} (ALLOW_PORT_FALLBACK=true).`, 'warn');
                        // Delay briefly before attempting fallback to avoid race conditions.
                        setTimeout(() => startServer(fallbackPort), 250);
                        return;
                    }

                    log(`To find and stop the process using the port, you can run:\n  sudo lsof -i :${port}\n  sudo fuser -k ${port}/tcp`, 'info');
                    // exit the process with a non-zero code to indicate failure (but let logs flush)
                    setTimeout(() => process.exit(1), 200);
                } else {
                    log(`Server error during startup: ${err && err.message ? err.message : err}`, 'error');
                    setTimeout(() => process.exit(1), 200);
                }
            });

            process.on('SIGTERM', close);
            process.on('SIGINT', close);
        };

        // Ensure we remove pid file and call close() on various exit scenarios
        process.on('exit', () => {
            // synchronous cleanup
            try { removePidFile(); } catch (e) {}
        });

        process.on('uncaughtException', async (err) => {
            log(`Uncaught exception: ${err && err.stack ? err.stack : err}`, 'error');
            try { await close(); } catch (e) {}
            removePidFile();
            // rethrow after cleanup to allow process to exit with non-zero
            setTimeout(() => process.exit(1), 50);
        });

        process.on('unhandledRejection', async (reason) => {
            log(`Unhandled rejection: ${reason}`, 'error');
            try { await close(); } catch (e) {}
            removePidFile();
            setTimeout(() => process.exit(1), 50);
        });

        // Write pid file for external cleanup and monitoring
        writePidFile();

        startServer(config.server.port);
    }

    return { app, dbConnection, mongoStore, close };
}

if (require.main === module) {
    createApp();
}

module.exports = createApp;