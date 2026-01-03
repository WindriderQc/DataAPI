const dns = require('dns');
dns.setDefaultResultOrder('ipv4first'); // Prioritize IPv4 to resolve connection timeout issues in some environments

const express = require('express');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const morgan = require('morgan');
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mdb = require('./mongoDB.js');
const liveDatas = require('./scripts/liveData.js');
const config = require('./config/config');
const pjson = require('./package.json');
const seedData = require('./scripts/bootstrap');
const setupAppContext = require('./utils/appContext');

// add missing imports used in this file
const { log } = require('./utils/logger');
const { logEvent } = require('./utils/eventLogger');
const { GeneralError } = require('./utils/errors');
const { attachUser, requireAuth } = require('./utils/auth');
const createIntegrationsRouter = require('./routes/integrations');
const { requireToolKey } = require('./middleware/toolAuth');
const { requireEitherAuth } = require('./middleware/flexAuth');
const { activityLogger } = require('./middleware/activityLogger');

const IN_PROD = config.env === 'production';

const app = express();
app.set('trust proxy', 1);

// Make version available in all templates
app.locals.appVersion = pjson.version;


// Middlewares & routes
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(path.join(__dirname, 'data'), { index: false, dotfiles: 'deny' }));
app.use('/exports', express.static(path.join(__dirname, 'public', 'exports'), { index: false, dotfiles: 'deny' }));
if (config.env !== 'test') {
    app.use(morgan('dev'));
}
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
    credentials: true,
    optionsSuccessStatus: 200
};
// CORS middleware is now applied directly to API routes.
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));



async function createApp() {
    log(`Starting Data API Server - v${pjson.version} - Environment: ${config.env}`);
    log("Initializing mongodb connections...");
    const dbConnection = await mdb.init();

    try {
        // Setup app context (DB handles, models, collections)
        await setupAppContext(app, dbConnection);

        // Insert boot log into the main application database
        if (config.env !== 'test') {
            const userLogsCollection = app.locals.dbs.mainDb.collection('userLogs');
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

        // Fetch and log collection info for all dbs (skip in tests for speed)
        if (config.env !== 'test') {
            app.locals.collectionInfo = [];
            for (const dbName in app.locals.dbs) {
                const db = app.locals.dbs[dbName];
                if (db) {
                    const collections = await db.listCollections().toArray();
                    for (const coll of collections) {
                        const count = await db.collection(coll.name).countDocuments();
                        const resolvedName = db.databaseName || dbName;
                        app.locals.collectionInfo.push({ db: resolvedName, collection: coll.name, count: count });
                    }
                }
            }
            log(`Collection Info for all dbs has been gathered.`);
        }

        // Initialize and attach models to app.locals
        app.locals.models = {
            User: createUserModel(dbConnection.mongooseConnection),
            Profile: require('./models/profileModel')
        };
        log("Models initialized and attached to app.locals.");

        // Cleanup stale "running" scans from previous server session
        const storageController = require('./controllers/storageController');
        await storageController.cleanupStaleScans(app.locals.dbs.mainDb);

        // Run bootstrap/seed logic
        await seedData(app);

    } catch (e) {
        log(`Could not initialize dbs on startup: ${e.message}`, 'warn');
    }

    // Session setup
    // In tests, prefer MemoryStore to avoid extra Mongo store handles (faster, fewer open handles).
    let mongoStore;
    if (config.env !== 'test') {
        mongoStore = new MongoDBStore({
            uri: dbConnection.getMongoUrl(),
            databaseName: config.db.mainDb,
            collection: 'mySessions',
            client: dbConnection.client,
        });
        mongoStore.on('error', (error) => log(`MongoStore Error: ${error}`, 'error'));
    }

    const sessionOptions = {
        name: config.session.name,
        secret: config.session.secret,
        ...(mongoStore ? { store: mongoStore } : {}),
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: IN_PROD,
            httpOnly: true,
            sameSite: IN_PROD ? 'none' : 'lax',
            maxAge: config.session.maxAge,
        }
    };
    if (config.session.cookie_domain) {
        if (IN_PROD) {
            sessionOptions.cookie.domain = config.session.cookie_domain;
        } else {
            log(`Session cookie domain '${config.session.cookie_domain}' present but ignored in non-production environment.`, 'warn');
        }
    }

    const sessionMiddleware = session(sessionOptions);

    // Apply session middleware, but skip it for tool API requests (n8n, API key)
    app.use((req, res, next) => {
        // Skip session for requests with x-api-key header (n8n, tool APIs)
        const apiKey = req.header('x-api-key');
        if (apiKey) {
            req.skipSession = true;
            return next();
        }

        // Apply session middleware for web/browser requests
        sessionMiddleware(req, res, next);
    });

    // Attach user to res.locals for all routes (web pages need this for templates)
    app.use((req, res, next) => {
        if (req.skipSession) {
            return next();
        }
        attachUser(req, res, next);
    });

    // Activity logger: logs authenticated user page views with location data
    app.use((req, res, next) => {
        if (req.skipSession) {
            return next();
        }
        activityLogger(req, res, next);
    });

    // LiveData will be initialized after the server is successfully listening
    // to avoid performing DB mutations before the app has fully started.
    // Do not auto-start LiveData until the server is successfully listening.
    // liveDatas may perform DB mutations (e.g., flushing the Quake collection),
    // so we initialize it only after the server has bound to the port.

    const apiLimiter = rateLimit({ ...config.rateLimit, standardHeaders: true, legacyHeaders: false });
    // Exempt storage status endpoint from rate limiting (needs frequent polling)
    app.use('/api/', (req, res, next) => {
        // Use originalUrl to match full path regardless of mounting
        const url = req.originalUrl || req.url;
        if (url.includes('/v1/storage/scans') || 
            url.includes('/v1/system/resources') || 
            url.includes('/v1/storage/n8n/status') ||
            url.includes('/v1/files/exports')) {
            return next();
        }
        return apiLimiter(req, res, next);
    });

    // Session-based (browser) routes for database access (no API key required)
    app.get('/databases/stats', (req, res) => {
        const stats = app.locals.collectionInfo || [];
        const collections = stats.map(s => ({ name: s.collection, count: s.count, db: s.db }));
        res.json({
            status: 'success',
            data: {
                collections: collections
            }
        });
    });

    // Tool APIs: accept EITHER session auth OR API key (for web UI and external tools)
    // Mount BEFORE user routes so API key auth can be processed first
    app.use('/api/v1', cors(corsOptions), requireEitherAuth, require("./routes/api.routes"));

    // User management API (session-based, available to authenticated users)
    app.use('/api/v1', requireAuth, require("./routes/user.routes"));

    // Janitor routes (requires either auth)
    app.use('/api/v1/janitor', cors(corsOptions), requireEitherAuth, require("./routes/janitor.routes"));

    // Web routes (session-based authentication)
    app.use('/', require("./routes/auth.routes"));
    app.use('/', require("./routes/web.routes"));

    // Integrations router (tool-only)
    app.use("/integrations", requireToolKey, createIntegrationsRouter(app.locals.dbs.mainDb));
    app.get("/health", (req, res) => res.json({ ok: true, version: pjson.version, ts: Date.now() }));

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
        // For unhandled errors, log them as critical events for the feed.
        // Emit a concise message to the feed (so public subscribers see a short description),
        // and keep the full stack in the server logs for debugging.
        const shortMsg = err && err.message ? `Internal server error: ${String(err.message).split('\n')[0].slice(0, 200)}` : 'An internal server error occurred.';
        try {
            const stack = err && err.stack ? String(err.stack) : undefined;
            const meta = { path: req && req.originalUrl ? req.originalUrl : undefined };
            // pass stack/meta so that the private/admin feed can display full details
            logEvent(shortMsg, 'error', { stack, meta });
        } catch (e) {
            // If event logging fails, still continue to log locally.
            log(`Failed to emit error event: ${e && e.message ? e.message : e}`, 'error');
        }

        // Log full stack to server logs for diagnostics (not emitted to public feed)
        log(err && err.stack ? err.stack : String(err), 'error');

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
    };

    if (require.main === module) {
        const startServer = (port) => {
            server = app.listen(port, async () => {
                log(`\n\nData API Server running at port ${port}`);
                try {
                    if (config.env !== 'test') {
                        // LiveData uses the mainDb in single-DB-per-env setup
                        liveDatas.init(app.locals.dbs.mainDb);
                        log("LiveData  -  v" + liveDatas.version);
                    }
                } catch (e) {
                    log(`Failed to initialize LiveData after server start: ${e && e.message ? e.message : e}`, 'warn');
                }
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

        };
        process.on('uncaughtException', async (err) => {
            log(`Uncaught exception: ${err && err.stack ? err.stack : err}`, 'error');
            try { await close(); } catch (e) { }
            // allow process to exit with non-zero after cleanup
            setTimeout(() => process.exit(1), 50);
        });

        process.on('unhandledRejection', async (reason) => {
            log(`Unhandled rejection: ${reason}`, 'error');
            try { await close(); } catch (e) { }
            setTimeout(() => process.exit(1), 50);
        });

        startServer(config.server.port);
    }

    return { app, dbConnection, close };
}

if (require.main === module) {
    createApp();
}

module.exports = createApp;