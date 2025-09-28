const startServer = require('../data_serv');
const { closeServer: closeMongoServer } = require('../mongooseDB');
const mongoose = require('mongoose');

const setup = async () => {
    const { app, close: closeHttpServer, dbConnection } = await startServer();
    const datasDb = dbConnection.getDb('datas');

    // Seed the database with some data for testing
    await datasDb.collection('users').insertOne({ name: 'Test User' });
    await datasDb.collection('devices').insertOne({ name: 'Test Device' });
    await datasDb.collection('mews').insertOne({ message: 'Test Mew' });

    return { app, db: datasDb, closeHttpServer, dbConnection };
};

const teardown = async ({ closeHttpServer, dbConnection }) => {
    if (closeHttpServer) {
        await closeHttpServer();
    }
    if (dbConnection) {
        await dbConnection.close();
    }
};

const afterAllTests = async () => {
    await closeMongoServer();
};

module.exports = { setup, teardown, afterAllTests };