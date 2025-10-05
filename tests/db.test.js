const { setup, fullTeardown } = require('./test-setup');
const config = require('../config/config');

describe('DB runtime shape', () => {
  let app, db, dbConnection, mongoStore, close;

  beforeAll(async () => {
    const res = await setup();
    app = res.app;
    db = res.db;
    dbConnection = res.dbConnection;
    mongoStore = res.mongoStore;
    close = res.close;
  });

  afterAll(async () => {
    await fullTeardown({ dbConnection, mongoStore, close });
  });

  test('app.locals.dbs.mainDb exists and matches config', () => {
    expect(app.locals.dbs).toBeDefined();
    expect(app.locals.dbs.mainDb).toBeDefined();
    expect(app.locals.dbs.mainDb.databaseName).toBe(config.db.mainDb);
  });
});
