const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();
const mdb = require('./mongooseDB');
const liveDatas = require('./scripts/liveData.js');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { MongoMemoryServer } = require('mongodb-memory-server');
const pjson = require('./package.json');

const PORT = process.env.PORT || 3003;
const dbCollectionName = process.env.NODE_ENV === 'production' ? 'datas' : 'devdatas';  

const { attachUser } = require('./utils/auth');

const app = express();

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

    console.error(err.stack);
    return res.status(500).json({
        status: 'error',
        message: 'An internal server error occurred.'
    });
});

async function startServer() {
    try {
        await mdb.init();

        // Session configuration
        app.use(session({
            name: process.env.SESS_NAME || 'sid',
            secret: process.env.SESS_SECRET || 'default-secret',
            resave: false,
            saveUninitialized: false,
            store: MongoStore.create({
                mongoUrl: mdb.getMongoUrl(),
                collectionName: 'sessions',
                ttl: parseInt(process.env.SESS_LIFETIME) || 1000 * 60 * 60 * 2, // 2 hours
              }),
            cookie: {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: parseInt(process.env.SESS_LIFETIME) || 1000 * 60 * 60 * 2 // 2 hours
            }
        }));


        // The `getCollections` call seems to be for debugging/logging,
        // let's keep it here but with proper error handling.
        try {
            console.log("Collections: ", await mdb.getCollections());
        } catch (e) {
            console.warn("Could not retrieve collection list on startup:", e.message);
        }

        // Apply attachUser middleware
        app.use(attachUser);

        // Apply rate limiting and routes
        const rateLimit = require('express-rate-limit');
        const apiLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100,
            standardHeaders: true,
            legacyHeaders: false,
        });
        app.use('/api/', apiLimiter);
        app.use('/', require("./routes/auth.routes"));
        app.use('/', require("./routes/web.routes"));
        app.use('/api/v1', require("./routes/api.routes"));

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
            console.error(err.stack);
            return res.status(500).json({ status: 'error', message: 'An internal server error occurred.' });
        });

        if (process.env.NODE_ENV !== 'test') {
            app.listen(PORT, () => {
                console.log(`\n\nData API Server running at port ${PORT}`);
                liveDatas.init();
                console.log("LiveData  -  v" + liveDatas.version);
            });
        }
        return app;
    } catch (err) {
        console.error('Failed to initialize database:', err);
        process.exit(1);
    }
}

// Start the server only if the file is run directly
if (require.main === module) {
    startServer();
}

module.exports = startServer;
