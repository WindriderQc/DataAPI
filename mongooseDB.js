const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { log } = require('./utils/logger');

let mongoServer;

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
        //console.log('DB composed url:', mongourl);
    }

    // Establish a single, unified Mongoose connection
    await mongoose.connect(mongourl, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    const mainConnection = mongoose.connection;

    // Function to get a specific DB from the main Mongoose connection
    const getDb = (dbName) => mainConnection.useDb(dbName, { useCache: true });

    const getMongoUrl = () => mongourl;

    // The close function now only needs to manage the single Mongoose connection
    const close = async () => {
        await mongoose.disconnect();
    };

    // Return the necessary components, deriving the native client from the Mongoose connection
    return {
        getDb,
        getMongoUrl,
        close,
        client: mainConnection.getClient(),
        mongooseConnection: mainConnection
    };
};

const closeServer = async () => {
    if (mongoServer) {
        await mongoServer.stop();
        mongoServer = null;
    }
};

module.exports = { init, closeServer };