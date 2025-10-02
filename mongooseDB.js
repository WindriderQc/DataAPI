const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require('mongodb');
const { log } = require('./utils/logger');

let mongoServer; // This can be shared across connections in a test env

const init = async () => {
    let mongourl;

    if (process.env.NODE_ENV !== 'production') {
        if (!mongoServer) {
            mongoServer = await MongoMemoryServer.create();
        }
        mongourl = mongoServer.getUri();
    } else {
        if (!process.env.MONGO_URL) {
            throw new Error('MONGO_URL environment variable is not set for production environment.');
        }
        mongourl = process.env.MONGO_URL + process.env.MONGO_DB_NAME + process.env.MONGO_OPTIONS;
        console.log('DB composed url:', mongourl);
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