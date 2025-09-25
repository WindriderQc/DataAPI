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

const PORT = process.env.PORT || 3003;
const IN_PROD = process.env.NODE_ENV === 'production'  // for https channel...  IN_PROD will be true if in production environment    If true while on http connection, session cookie will not work
const dbCollectionName = process.env.NODE_ENV === 'production' ? 'datas' : 'devdatas';  


const mongoStore = new MongoDBStore({ uri: process.env.MONGO_URL, collection: 'mySessions'}, (err) => { if(err) console.log( 'MongoStore connect error: ', err) } );
mongoStore.on('error', (error) => console.log('MongoStore Error: ', error) );

const sessionOptions = {
  name: process.env.SESS_NAME,
  resave: false,
  saveUninitialized: false,  // only save when something changes
  secret: process.env.SESS_SECRET,
  store: mongoStore,
  cookie: {  
        secure: IN_PROD,         // true if HTTPS
        httpOnly: true,
        sameSite: 'none',        // needed for cross-site
        maxAge: 1000 * 60 * 60   // 1h (example)
    }// Please note that secure: true is a recommended option. However, it requires an https-enabled website, i.e., HTTPS is necessary for secure cookies. If secure is set, and you access your site over HTTP, the cookie will not be set.
}



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
app.use(session(sessionOptions))

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


        // The `getCollections` call seems to be for debugging/logging,
        // let's keep it here but with proper error handling.
        try {
            console.log("Collections: ", await mdb.getCollections());
        } catch (e) {
            console.warn("Could not retrieve collection list on startup:", e.message);
        }

        // Create a dedicated router for web routes that require session handling
        const webRouter = express.Router();
        webRouter.use(attachUser); // Apply attachUser middleware only to web routes
        webRouter.use('/', require("./routes/auth.routes"));
        webRouter.use('/', require("./routes/web.routes"));
        app.use('/', webRouter); // Mount the web router

        // Apply rate limiting and API routes
        const apiLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100,
            standardHeaders: true,
            legacyHeaders: false,
        });
        app.use('/api/', apiLimiter);
        app.use('/api/v1', require("./routes/api.routes")); // API routes don't use session middleware

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
