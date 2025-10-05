process.env.NODE_ENV = 'test';
const createApp = require('../data_serv');
const config = require('../config/config');
const { logger } = require('../utils/logger');

const setup = async () => {
    const { app, dbConnection, mongoStore, close } = await createApp();

    // The dbConnection object now provides direct access to the configured database.
    // Expose `mainDb` which tests and application code will use.
    const db = {
        mainDb: dbConnection.dbs.mainDb,
    };

    return { app, db, dbConnection, mongoStore, close };
};

const fullTeardown = async ({ close }) => {
    if (typeof close === 'function') {
        await close();
    }
    logger.close();
};

module.exports = { setup, fullTeardown };