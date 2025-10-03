process.env.NODE_ENV = 'test'; // Set the environment to 'test'
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

const fullTeardown = async ({ close, mongoStore, dbConnection }) => {
    if (typeof close === 'function') {
        await close();
    } else {
        if (mongoStore?.client) {
            await mongoStore.client.close();
        }
        if (dbConnection?.close) {
            await dbConnection.close();
        }
    }
    //await liveDatas.close(); // Explicitly close liveData services
    await closeMongoServer();

    logger.close();
};

module.exports = { setup, fullTeardown };