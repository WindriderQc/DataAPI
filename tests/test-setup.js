const startServer = require('../data_serv');
const mdb = require('../mongooseDB');

let server;
let app;
let db;

const setup = async () => {
    if (server) {
        return { app, db };
    }
    const { app: expressApp, close } = await startServer();
    app = expressApp;
    server = { close };
    db = mdb.getDb('datas');
    return { app, db };
};

const teardown = async () => {
    if (server) {
        await server.close();
        server = null;
    }
    await mdb.close();
};

module.exports = { setup, teardown };