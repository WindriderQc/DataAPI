const startServer = require('../data_serv');
const { closeServer: closeMongoServer } = require('../mongooseDB');
const mongoose = require('mongoose');
const { logger } = require('../utils/logger'); // Import the logger instance

const setup = async () => {
    const { app, close: closeHttpServer, dbConnection } = await startServer();
    const datasDb = dbConnection.getDb('datas');

    // Seed the database with some data for testing
    await datasDb.collection('users').insertOne({ name: 'Test User' });
    await datasDb.collection('devices').insertOne({ name: 'Test Device' });
    await datasDb.collection('mews').insertOne({ message: 'Test Mew' });

    return { app, db: datasDb, closeHttpServer, dbConnection };
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