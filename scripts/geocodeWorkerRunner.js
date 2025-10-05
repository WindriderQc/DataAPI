const mdb = require('../mongoDB');
const { start, stop } = require('./geocodeWorker');
const { log } = require('../utils/logger');

(async () => {
  try {
    const args = process.argv.slice(2);
    const scanAllCollections = process.env.GEOCODE_SCAN === '1' || args.includes('--scan');
    const oneShot = process.env.GEOCODE_ONESHOT === '1' || args.includes('--one-shot');

    const dbConn = await mdb.init();
    const db = dbConn.dbs.mainDb;
    log('Starting geocode worker against DB: ' + (db && db.databaseName) + (scanAllCollections ? ' (scan mode)' : ''));

    // graceful shutdown
    process.on('SIGINT', async () => {
      log('Received SIGINT, stopping geocode worker...');
      stop();
      // allow a short time for loop to exit
      setTimeout(() => process.exit(0), 500);
    });

    await start(db, { pollInterval: 2000, scanAllCollections, oneShot });
  } catch (e) {
    log('Failed to start geocode worker: ' + (e && e.message ? e.message : e), 'error');
    process.exit(1);
  }
})();
