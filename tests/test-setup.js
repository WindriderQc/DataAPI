process.env.NODE_ENV = 'test';
const createApp = require('../data_serv');
const config = require('../config/config');
const { logger } = require('../utils/logger');

const setup = async () => {
    const { app, dbConnection, mongoStore, close } = await createApp();

    const modelDb = dbConnection.getDb(config.db.modelDbName);
    const datasDb = dbConnection.getDb('datas');
    const db = { modelDb, datasDb };

    return { app, db, dbConnection, mongoStore, close };
};

const fullTeardown = async ({ close }) => {
    if (typeof close === 'function') {
        await close();
    }
    logger.close();
};

module.exports = { setup, fullTeardown };