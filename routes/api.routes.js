const router = require('express').Router();

const { body } = require('express-validator');
const genericController = require('../controllers/genericController');
const logController = require('../controllers/logController');
const mewController = require('../controllers/mewController');
const { fetchWithTimeoutAndRetry } = require('../utils/fetch-utils');

const liveDatasController = require('../controllers/liveDataController');
const feedController = require('../controllers/feedController');
const storageController = require('../controllers/storageController');
const fileBrowserController = require('../controllers/fileBrowserController');
const FileBrowserControllerNew = require('../controllers/fileBrowserControllerNew');
const fileExportController = require('../controllers/fileExportController');
const { generateOptimizedReport } = require('../controllers/fileExportControllerOptimized');
const externalApiController = require('../controllers/externalApiController');

// A default API response to check if the API is up
router.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'DataAPI tool server is running'
  });
});

// Deterministic geolocation response for tests; real fetch in non-test env.
router.get('/geolocation', async (req, res) => {
  if (process.env.NODE_ENV === 'test') {
    return res.json({ country: 'TestCountry' });
  }

  try {
    const ipifyResponse = await fetchWithTimeoutAndRetry('https://api64.ipify.org?format=json', { timeout: 4000, retries: 1, name: 'ipify' });
    const { ip: publicIp } = await ipifyResponse.json();
    const geoResponse = await fetchWithTimeoutAndRetry(`http://ip-api.com/json/${publicIp}`, { timeout: 4000, retries: 1, name: 'ip-api.com' });
    const geo = await geoResponse.json();
    return res.json(geo);
  } catch (error) {
    return res.status(500).json({ error: 'Error fetching geolocation', details: error && error.message ? error.message : String(error) });
  }
});

// Mew endpoints (legacy + v2)
router.get('/mew', mewController.index);
router.get('/mews', mewController.getAllMews);
router.post('/mews', [body('name').trim().escape(), body('content').trim().escape()], mewController.createMew);
router.get('/v2/mews', mewController.getMewsV2);
router.post('/v2/mews', [body('name').trim().escape(), body('content').trim().escape()], mewController.createMew);

// Scoped generic CRUD for specific collections (replaces the dangerous catch-all)
const alarmsController = genericController('alarms');
router.route('/alarms')
  .get((req, res, next) => alarmsController.getAll(req, res, next))
  .post((req, res, next) => alarmsController.create(req, res, next));

const checkinsController = genericController('checkins');
router.route('/checkins')
  .get((req, res, next) => checkinsController.getAll(req, res, next))
  .post((req, res, next) => checkinsController.create(req, res, next));

// Logs (used by tooling/tests)
router.get('/logs/user', logController.getUserLogs);
router.post('/logs/user', [body('*').escape()], logController.createUserLog);
router.get('/logs/server', logController.getServerLogs);
router.post('/logs/server', [body('*').escape()], logController.createServerLog);

// Storage scan routes
router.get('/storage/scans', storageController.listScans);
router.post('/storage/scan', storageController.scan);
router.get('/storage/status/:scan_id', storageController.getStatus);
router.post('/storage/stop/:scan_id', storageController.stopScan);
router.get('/storage/directory-count', storageController.getDirectoryCount);

// File browser routes
router.get('/files/browse', FileBrowserControllerNew.browseFiles);
router.get('/files/search', fileBrowserController.search);
router.get('/files/stats', FileBrowserControllerNew.getStats);
router.get('/files/tree', FileBrowserControllerNew.getDirectoryTree);
router.get('/files/duplicates', FileBrowserControllerNew.findDuplicates);
router.get('/files/cleanup-recommendations', FileBrowserControllerNew.getCleanupRecommendations);

// File exports
router.post('/files/export', fileExportController.generateReport);
router.get('/files/exports', fileExportController.listExports);
router.delete('/files/exports/:filename', fileExportController.deleteExport);

// Optimized exports (fixes 20MB issue)
router.get('/files/export-optimized/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ['full', 'summary', 'media', 'stats'];

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid report type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    const startTime = Date.now();
    const report = await generateOptimizedReport(req.app.locals.dbs.mainDb, type);
    const generationTime = Date.now() - startTime;

    report.metadata = {
      generationTimeMs: generationTime,
      optimized: true,
      timestamp: new Date().toISOString()
    };

    res.json({
      status: 'success',
      message: `Optimized ${type} report generated successfully`,
      data: report
    });
  } catch (error) {
    console.error('Optimized export error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate optimized report',
      error: error.message
    });
  }
});

// Live data
router.get('/iss', liveDatasController.iss);
router.get('/quakes', liveDatasController.quakes);

// SSE feed (tool stream)
router.get('/feed/events', feedController.sendFeedEvents);
router.get('/feed/events/private', feedController.sendPrivateFeedEvents);

// External API / live-data helpers
router.get('/weather', externalApiController.getWeather);
router.get('/tides', externalApiController.getTides);
router.get('/tle', externalApiController.getTle);
router.get('/pressure', externalApiController.getPressure);
router.get('/ec-weather', externalApiController.getEcWeather);

// Expose collection stats (cached at boot)
router.get('/stats', (req, res) => {
    const stats = req.app.locals.collectionInfo || [];
    res.json({
        status: 'success',
        data: stats
    });
});

// Legacy endpoint support for databases.html
router.get('/databases/stats', (req, res) => {
    const stats = req.app.locals.collectionInfo || [];
    const collections = stats.map(s => ({ name: s.collection, count: s.count, db: s.db }));
    res.json({
        status: 'success',
        data: {
            collections: collections
        }
    });
});

module.exports = router;
