const express = require('express');
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const mdb = require('./mongooseDB');
const liveDatas = require('./scripts/liveData.js');
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = process.env.PORT || 3003;

const app = express();

// Middlewares & routes
app.use(cors({ origin: '*', optionsSuccessStatus: 200 }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const xff = req.headers['x-forwarded-for'];
        if (xff) {
            return xff.split(',')[0].trim();
        }
        return req.ip;
    },
}));
app.use('/', require("./routes/web.routes"));
app.use('/api/v1', require("./routes/api.routes"));

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
    const dbName = process.env.NODE_ENV === 'production' ? 'datas' : 'devdatas';
    let mongourl;

    if (process.env.NODE_ENV !== 'production') {
        const mongoServer = await MongoMemoryServer.create();
        mongourl = mongoServer.getUri();
        console.log("Using in-memory MongoDB server at", mongourl);
    } else {
        if (!process.env.MONGO_URL) {
            console.error('MONGO_URL environment variable is not set for production environment.');
            process.exit(1);
        }
        mongourl = process.env.MONGO_URL + dbName + (process.env.MONGO_OPTIONS || '');
    }

    try {
        await mdb.init(mongourl, dbName, async () => {
            try {
                console.log("Collections: ", await mdb.getCollections());
            } catch (e) {
                // ignore
            }
        });

        app.listen(PORT, () => {
            console.log(`\n\nData API Server running at port ${PORT}`);
            liveDatas.init();
            console.log("LiveData  -  v" + liveDatas.version);
        });
    } catch (err) {
        console.log('Failed to initialize database:', err);
    }
}

// Start the server only if the file is run directly
if (require.main === module) {
    startServer();
}

module.exports = app; // Export the app for testing
