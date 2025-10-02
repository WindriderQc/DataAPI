const startServer = require('../data_serv');
const { closeServer: closeMongoServer } = require('../mongooseDB');
const mongoose = require('mongoose');
const { logger } = require('../utils/logger'); // Import the logger instance
const config = require('../config/config');

const setup = async () => {
    const { app, close: closeHttpServer, dbConnection } = await startServer();
    const modelDb = dbConnection.getDb(config.db.modelDbName);
    const datasDb = dbConnection.getDb('datas');

    // Seed the database with some data for testing
    // User data goes into the main model DB
    await modelDb.collection('users').insertOne({ name: 'Test User' });
    // Other test data goes into the 'datas' DB
    await datasDb.collection('devices').insertOne({ name: 'Test Device' });
    await datasDb.collection('mews').insertOne({ message: 'Test Mew' });

    // Return both db connections for flexibility in tests
    return { app, db: { modelDb, datasDb }, closeHttpServer, dbConnection };
};

const fullTeardown = async ({ closeHttpServer, dbConnection }) => {
    // First, close the server to stop accepting new connections
    if (closeHttpServer) {
        await closeHttpServer();
    }
    // Then, close the database connection
    if (dbConnection && typeof dbConnection.close === 'function') {
        await dbConnection.close();
    }
    // Stop the in-memory MongoDB server instance
    await closeMongoServer();

    // Finally, close the logger to release any handles
    logger.close();
};

module.exports = { setup, fullTeardown };