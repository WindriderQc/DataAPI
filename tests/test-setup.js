process.env.NODE_ENV = 'test';
const createApp = require('../data_serv');
const { logger } = require('../utils/logger');

// Increase the timeout for the initial setup
jest.setTimeout(30000);

beforeAll(async () => {
  const { app, dbConnection, mongoStore, close } = await createApp();
  global.app = app;
  // Expose mainDb directly for convenience in tests
  global.db = { mainDb: dbConnection.dbs.mainDb };
  global.dbConnection = dbConnection;
  global.mongoStore = mongoStore;
  global.close = close;
});

afterAll(async () => {
  if (typeof global.close === 'function') {
    await global.close();
  }
  // Close the logger stream
  logger.close();
});