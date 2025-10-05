const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require('mongodb');
const { log } = require('./utils/logger');

let mongoServer; // This can be shared across connections in a test env

const init = async () => {
    let mongourl;
    // Use an in-memory MongoDB server in test environment for isolation, even if MONGO_URL exists.
    if (process.env.NODE_ENV === 'test') {
        if (!mongoServer) {
            mongoServer = await MongoMemoryServer.create();
        }
        mongourl = mongoServer.getUri();
        console.log('Using mongodb-memory-server for test environment with uri:', mongourl);
    } else if (process.env.MONGO_URL) {
        // Prefer a configured MongoDB URL when available for non-test environments
        mongourl = process.env.MONGO_URL + (process.env.MONGO_DB_NAME || '') + (process.env.MONGO_OPTIONS || '');
        console.log('DB composed url from MONGO_URL:', mongourl);
    } else {
        // Only start an in-memory MongoDB server when explicitly enabled outside of tests
        const useMemory = process.env.USE_MONGO_MEMORY === 'true';
        if (useMemory) {
            if (!mongoServer) {
                mongoServer = await MongoMemoryServer.create();
            }
            mongourl = mongoServer.getUri();
            console.log('Using mongodb-memory-server with uri:', mongourl);
        } else {
            throw new Error('MONGO_URL is not set and mongodb-memory-server is disabled. Set MONGO_URL or enable memory server with USE_MONGO_MEMORY=true');
        }
    }

    // Mongoose connection for models
    await mongoose.connect(mongourl);

    // Native client connection for other parts of the app
    const client = new MongoClient(mongourl, {
        useUnifiedTopology: true,
    });
    await client.connect();

    const databases = {
        SBQC: client.db('SBQC'),
        datas: client.db('datas'),
    };

    const getDb = (dbName = 'datas') => databases[dbName];

    const getMongoUrl = () => mongourl;

    const close = async () => {
        await client.close();
        await mongoose.disconnect();
    };

    return { getDb, getMongoUrl, close, client, mongooseConnection: mongoose.connection };
};

const closeServer = async () => {
    if (mongoServer) {
        await mongoServer.stop();
        mongoServer = null;
    }
};

module.exports = { init, closeServer };