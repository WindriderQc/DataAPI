const mdb = require('../mongoDB');
const { start } = require('./geocodeWorker');
const { log } = require('../utils/logger');

(async () => {
  try {
    const dbConn = await mdb.init();
    const db = dbConn.dbs.mainDb;
    log('Starting geocode worker against DB: ' + (db && db.databaseName));
    await start(db, { pollInterval: 2000 });
  } catch (e) {
    log('Failed to start geocode worker: ' + (e && e.message ? e.message : e), 'error');
    process.exit(1);
  }
})();
