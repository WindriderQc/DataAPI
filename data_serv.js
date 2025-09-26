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

                app.locals.collections = []
                    const list = await mdb.getCollections()

                    console.log("Assigning Collections to app.locals :")
                    for(coll of list) {
                        console.log(coll.name)
                        app.locals.collections[coll.name] =  mdb.getDb(coll.name)
                    }



            app.locals.collections = await mdb.getCollections();
            console.log("Collections: ", app.locals.collections);

             // The 'boot' collection will be created automatically by MongoDB if it doesn't exist upon the first insertOne operation.
                // No explicit conditional creation is needed unless specific collection options are required at creation time.
              /*  app.locals.collections.boot.insertOne({
                        logType: 'boot',
                        client: 'server',
                        content: 'dbServer boot',
                        authorization: 'none',
                        host: IN_PROD ? "Production Mode" : "Developpement Mode",
                        ip: 'localhost',
                        hitCount: 'N/A',
                        created: Date.now()
                    })*/

                // Fetch collection names and document counts
                app.locals.collectionInfo = {}
                for (const coll of list) {
                    const count = await app.locals.collections[coll.name].countDocuments()
                    app.locals.collectionInfo[coll.name] = count
            }
  console.log("Collection Info:", app.locals.collectionInfo, '\n__________________________________________________\n\n')

        } catch (e) {
            console.warn("Could not retrieve collection list on startup:", e.message);
        }

        const mongoStore = new MongoDBStore({
            uri: mdb.getMongoUrl(),
            collection: 'mySessions'
        });
        mongoStore.on('error', (error) => console.log('MongoStore Error: ', error));

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
