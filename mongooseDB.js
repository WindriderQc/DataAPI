const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let _db;
let _connection;
let mongoServer;

const mongooseDB = {
    init: async function() {
        if (_connection) {
            return;
        }

        const dbName = process.env.NODE_ENV === 'production' ? 'datas' : 'devdatas';
        let mongourl;

        if (process.env.NODE_ENV !== 'production') {
            mongoServer = await MongoMemoryServer.create();
            mongourl = mongoServer.getUri();
            console.log("Using in-memory MongoDB server at", mongourl);
        } else {
            if (!process.env.MONGO_URL) {
                throw new Error('MONGO_URL environment variable is not set for production environment.');
            }
            mongourl = process.env.MONGO_URL;
        }

        try {
            const conn = await mongoose.connect(mongourl, {
                dbName: dbName,
                family: 4,
            });

            _connection = conn.connection;
            _db = _connection.db;

            console.log(`\nMongoose connected to: ${_db.databaseName}\n`);

            _connection.on('error', (err) => {
                console.error('Mongoose connection error:', err);
                process.exit(1);
            });
        } catch (error) {
            console.error('Failed to connect to MongoDB during init:', error);
            process.exit(1);
        }
    },

    getCollections: async function() {
        if (!_db) {
            throw new Error("Database not initialized. Call init() first.");
        }
        const col = await _db.listCollections().toArray();
        return col;
    },

    changeDb: function(dbName) {
        if (!_connection) {
            throw new Error("Database not initialized. Call init() first.");
        }
        const newDbConnection = _connection.useDb(dbName);
        _db = newDbConnection.db;
    },

    getDb: function() {
        if (!_db) {
            throw new Error("Database not initialized. Call init() first.");
        }
        return _db;
    },

    getCollection: function(name) {
        if (!_db) {
            throw new Error("Database not initialized. Call init() first.");
        }
        return _db.collection(name);
    },

    getConnection: function() {
        if (!_connection) {
            throw new Error("Database not initialized. Call init() first.");
        }
        return _connection;
    },

    close: async function() {
        if (_connection) {
            await _connection.close();
            _connection = null;
            _db = null;
        }
        if (mongoServer) {
            await mongoServer.stop();
            mongoServer = null;
        }
    }
};

module.exports = mongooseDB;