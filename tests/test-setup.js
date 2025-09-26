const startServer = require('../data_serv');
const { closeServer: closeMongoServer } = require('../mongooseDB');

const setup = async () => {
    const { app, close: closeHttpServer, dbConnection } = await startServer();
    const db = dbConnection.getDb('datas');
    return { app, db, closeHttpServer, dbConnection };
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