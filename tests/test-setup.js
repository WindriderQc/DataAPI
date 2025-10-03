const createApp = require('../data_serv');
const { closeServer: closeMongoServer } = require('../mongooseDB');
const { logger } = require('../utils/logger');
const config = require('../config/config');
const liveDatas = require('../scripts/liveData'); // Import liveDatas

const setup = async () => {
    const { app, dbConnection, mongoStore, close } = await createApp();

    // Create the db object that the tests expect
    const modelDb = dbConnection.getDb(config.db.modelDbName);
    const datasDb = dbConnection.getDb('datas');
    const db = { modelDb, datasDb };

    return { app, db, dbConnection, mongoStore, close };
};

const fullTeardown = async ({ dbConnection, mongoStore, close }) => {
    // Gracefully close all connections and services
    if (close) {
        await close();
    } else {
        await liveDatas.close(); // Explicitly close liveData services
        if (mongoStore && typeof mongoStore.close === 'function') {
            mongoStore.close(); // This is synchronous
        }
        if (dbConnection && typeof dbConnection.close === 'function') {
            await dbConnection.close();
        }
        await closeMongoServer();
    }
    logger.close();
};

module.exports = { setup, fullTeardown };