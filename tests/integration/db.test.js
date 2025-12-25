const config = require('../../config/config');

describe('DB runtime shape', () => {
  // No beforeAll/afterAll needed, handled by global setup

  test('app.locals.dbs.mainDb exists and matches config', () => {
    // 'app' is global
    expect(app.locals.dbs).toBeDefined();
    expect(app.locals.dbs.mainDb).toBeDefined();
    expect(app.locals.dbs.mainDb.databaseName).toBe(config.db.mainDb);
  });
});