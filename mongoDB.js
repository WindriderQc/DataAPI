const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require('mongodb');
const config = require('./config/config');
const { log } = require('./utils/logger');

let mongoServer;

const init = async () => {
    let mongourl;

    // For 'test' environment, always use an isolated in-memory server.
    if (config.env === 'test') {
        if (!mongoServer) {
            mongoServer = await MongoMemoryServer.create();
        }
        mongourl = mongoServer.getUri();
        log(`Using mongodb-memory-server for test environment: ${mongourl}`);
    } else if (process.env.MONGO_URL) {
        // For other environments (dev, prod), prioritize MONGO_URL.
        mongourl = process.env.MONGO_URL;
        log(`Connecting to MongoDB cluster at: ${mongourl}`);
    } else {
        // If no MONGO_URL and not in test mode, we cannot proceed.
        throw new Error('MONGO_URL environment variable is not set. A database connection is required for this environment.');
    }

    // Mongoose connects to the server. The individual models will use `useDb`
    // to select the correct database from this single connection pool.
    await mongoose.connect(mongourl);
    log(`Mongoose connected to server.`);

    // Native client also connects to the server.
    const client = new MongoClient(mongourl);
    await client.connect();
    log('MongoDB native client connected successfully to server.');

    // Create a dictionary of database connections based on the config
    const databases = config.db.appDbNames.reduce((acc, dbName) => {
        acc[dbName] = client.db(dbName);
        log(`Connection established for database: ${dbName}`);
        return acc;
    }, {});

    const getDb = (dbName = config.db.mainDb) => { const db = databases[dbName]; if (!db) throw new Error(`Unknown database: ${dbName}`); return db; };

    const getMongoUrl = () => mongourl;

    const close = async () => {
        await client.close();
        await mongoose.disconnect();
        log('MongoDB connections closed.');
    };


    return { getDb, getMongoUrl, close, client, mongooseConnection: mongoose.connection, db: getDb(config.db.mainDb) };
};

const closeServer = async () => {
    if (mongoServer) {
        await mongoServer.stop();
        mongoServer = null;
    }
};

module.exports = { init, closeServer };