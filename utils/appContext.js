const { log } = require('./logger');
const config = require('../config/config');
const createUserModel = require('../models/userModel');

/**
 * Initializes app.locals with database handles, models, and collection info.
 * @param {Express.Application} app
 * @param {Object} dbConnection - Object returned by mdb.init()
 */
async function setupAppContext(app, dbConnection) {
    try {
        log("Assigning dbs to app.locals...");
        app.locals.dbs = dbConnection.dbs;
        app.locals.mongoClient = dbConnection.client;

        if (app.locals.mongoClient) {
            app.locals.dbs.sbqcDb = app.locals.mongoClient.db('SBQC');
        }

        log("DB assigned: mainDb");
        try {
            const activeName = app.locals.dbs.mainDb && app.locals.dbs.mainDb.databaseName
                ? app.locals.dbs.mainDb.databaseName
                : config.db.mainDb;
            log(`Active database name: ${activeName}`);
        } catch (e) {
            // ignore logging errors
        }

        // Initialize and attach models
        app.locals.models = {
            User: createUserModel(dbConnection.mongooseConnection)
        };
        log("Models initialized and attached to app.locals.");

        // Gather collection info
        app.locals.collectionInfo = [];
        for (const dbName in app.locals.dbs) {
            const db = app.locals.dbs[dbName];
            if (db) {
                const collections = await db.listCollections().toArray();
                for (const coll of collections) {
                    const count = await db.collection(coll.name).countDocuments();
                    const resolvedName = db.databaseName || dbName;
                    app.locals.collectionInfo.push({ db: resolvedName, collection: coll.name, count: count });
                }
            }
        }
        log(`Collection Info for all dbs has been gathered.`);

    } catch (e) {
        log(`Error setting up app context: ${e.message}`, 'error');
        throw e;
    }
}

module.exports = setupAppContext;
