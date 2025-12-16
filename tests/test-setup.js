process.env.NODE_ENV = 'test';
process.env.DATAAPI_API_KEY = process.env.DATAAPI_API_KEY || 'test-dataapi-api-key';
process.env.ISS_API_ENABLED = process.env.ISS_API_ENABLED || 'true';
process.env.QUAKES_API_ENABLED = process.env.QUAKES_API_ENABLED || 'true';
const createApp = require('../data_serv');
const { logger } = require('../utils/logger');

// Increase the timeout for the initial setup
jest.setTimeout(30000);

beforeAll(async () => {
  const { app, dbConnection, close } = await createApp();
  global.app = app;
  // Expose mainDb directly for convenience in tests
  global.db = { mainDb: dbConnection.dbs.mainDb };
  global.dbConnection = dbConnection;
  global.close = close;
});

afterAll(async () => {
  if (typeof global.close === 'function') {
    await global.close();
  }
  // Close the logger stream
  logger.close();
});