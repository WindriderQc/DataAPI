const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { MongoClient } = require('mongodb');

let client;
let mongoServer;
let mongourl;
const databases = {};

const mongooseDB = {
    init: async function() {
        if (client) {
            return;
        }

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
            client = new MongoClient(mongourl, {
                useUnifiedTopology: true,
            });
            await client.connect();
            console.log("\nMongoDB client connected\n");

            // Initialize default databases
            const dbNames = ['SBQC', 'datas'];
            for (const dbName of dbNames) {
                databases[dbName] = client.db(dbName);
            }
            console.log("Databases initialized:", Object.keys(databases));

        } catch (error) {
            console.error('Failed to connect to MongoDB during init:', error);
            process.exit(1);
        }
    },

    getDb: function(dbName = 'datas') {
        if (!databases[dbName]) {
            throw new Error(`Database '${dbName}' not initialized. Call init() first.`);
        }
        return databases[dbName];
    },

    getCollection: function(dbName, collectionName) {
        const db = this.getDb(dbName);
        return db.collection(collectionName);
    },

    getMongoUrl: function() {
        if (!mongourl) {
            throw new Error("MongoDB URL not set. Call init() first.");
        }
        return mongourl;
    },

    close: async function() {
        if (client) {
            await client.close();
            client = null;
        }
        if (mongoServer) {
            await mongoServer.stop();
            mongoServer = null;
        }
    }
};

module.exports = mongooseDB;