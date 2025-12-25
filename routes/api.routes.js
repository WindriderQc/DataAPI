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
const fileExportController = require('../controllers/fileExportController');
const { generateOptimizedReport } = require('../controllers/fileExportControllerOptimized');
const externalApiController = require('../controllers/externalApiController');

// New imports from PR
const databasesController = require('../controllers/databasesController');
const { requireAuth } = require('../utils/auth');
const chatkitController = require('../controllers/chatkitController');
const weatherController = require('../controllers/weatherController');
const ollamaController = require('../controllers/ollamaController');
const liveDataConfigController = require('../controllers/liveDataConfigController');

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

// Dashboard v2 log endpoints
router.get('/v2/logs', logController.getLogsForSource);
router.get('/v2/logs/countries', logController.getCountryCounts);

// Storage scan routes
router.get('/storage/scans', storageController.listScans);
router.post('/storage/scan', storageController.scan);
router.get('/storage/status/:scan_id', storageController.getStatus);
router.post('/storage/stop/:scan_id', storageController.stopScan);
router.get('/storage/directory-count', storageController.getDirectoryCount);

// File browser routes
router.get('/files/browse', fileBrowserController.browseFiles);
// router.get('/files/search', fileBrowserController.search); // Consolidating, 'browseFiles' supports search
router.get('/files/stats', fileBrowserController.getStats);
router.get('/files/tree', fileBrowserController.getDirectoryTree);
router.get('/files/duplicates', fileBrowserController.findDuplicates);
router.get('/files/cleanup-recommendations', fileBrowserController.getCleanupRecommendations);

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
// Protected private feed (requires authentication) for user/device logs
router.get('/feed/events/private', requireAuth, feedController.sendPrivateFeedEvents);

// Secure token endpoint for ChatKit admin chat
router.post('/chatkit/token', requireAuth, chatkitController.createSessionToken);
// Send message to ChatKit session
router.post('/chatkit/message', requireAuth, chatkitController.sendChatMessage);
// Create realtime voice session for admin chat
router.post('/chatkit/realtime-session', requireAuth, chatkitController.createRealtimeSession);

// Database management routes
router.post('/databases/copy-prod-to-dev', databasesController.copyProdToDev);

// Server-Sent Events endpoint for copy progress
router.get('/databases/copy-progress/:jobId', (req, res) => {
    const { jobId } = req.params;
    const { get } = require('../utils/progressBus');
    const emitter = get(jobId);
    if (!emitter) {
        return res.status(404).json({ status: 'error', message: 'Job not found' });
    }

    // set SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
    });

    const onProgress = (data) => {
        res.write(`event: progress\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const onComplete = (data) => {
        res.write(`event: complete\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const onError = (data) => {
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    emitter.on('progress', onProgress);
    emitter.on('complete', onComplete);
    emitter.on('error', onError);

    // cleanup when client disconnects
    req.on('close', () => {
        emitter.off('progress', onProgress);
        emitter.off('complete', onComplete);
        emitter.off('error', onError);
    });
});

router.post('/weather/register-location', requireAuth, weatherController.registerLocation);

// LiveData Configuration
router.get('/livedata/config', requireAuth, liveDataConfigController.getConfigs);
router.post('/livedata/config', requireAuth, liveDataConfigController.updateConfig);

// Ollama routes
router.get('/ollama/models', requireAuth, ollamaController.listModels);
router.post('/ollama/chat', requireAuth, ollamaController.chat);

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

// Generic collection query endpoint - allows fetching items from any collection
router.get('/collection/:name/items', async (req, res, next) => {
    try {
        const { name } = req.params;
        const db = req.app.locals.dbs?.mainDb;
        
        if (!db) {
            return res.status(500).json({
                status: 'error',
                message: 'Database connection not found'
            });
        }
        
        // Validate collection name exists in collectionInfo
        const allowedCollections = req.app.locals.collectionInfo || [];
        const collectionExists = allowedCollections.some(c => 
            (c.collection === name || c.name === name)
        );
        
        if (!collectionExists) {
            return res.status(404).json({
                status: 'error',
                message: `Collection '${name}' not found`
            });
        }
        
        const collection = db.collection(name);
        
        // Parse pagination parameters
        let { skip = 0, limit = 50, sort = 'desc' } = req.query;
        skip = parseInt(skip) || 0;
        limit = parseInt(limit) || 50;
        skip = skip < 0 ? 0 : skip;
        limit = Math.min(500, Math.max(1, limit)); // Clamp limit between 1 and 500
        
        const sortBy = sort === 'desc' ? -1 : 1;
        
        // Execute query with pagination
        const [total, documents] = await Promise.all([
            collection.countDocuments(),
            collection.find({}).skip(skip).limit(limit).sort({ _id: sortBy }).toArray()
        ]);
        
        res.json({
            status: 'success',
            message: 'Documents retrieved successfully',
            data: documents,
            meta: {
                total,
                skip,
                limit,
                sort,
                has_more: total - (skip + limit) > 0
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
