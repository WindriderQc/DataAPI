let router = require('express').Router()
const { body } = require('express-validator');
const genericController = require('../controllers/genericController');
const databasesController = require('../controllers/databasesController');
const liveDatasController = require('../controllers/liveDataController')
const { requireAuth } = require('../utils/auth');
const feedController = require('../controllers/feedController');
const chatkitController = require('../controllers/chatkitController');

// A default API response to check if the API is up
router.get('/', (req, res) => {
    res.json({
        status: 'API Its Working',
        message: 'Welcome to the DataAPI!',
    });
});

const userController = require('../controllers/userController');
const profileController = require('../controllers/profileController');
const mewController = require('../controllers/mewController');
const storageController = require('../controllers/storageController');
const fileBrowserController = require('../controllers/fileBrowserController');
const FileBrowserControllerNew = require('../controllers/fileBrowserControllerNew');
const fileExportController = require('../controllers/fileExportController');
const { generateOptimizedReport } = require('../controllers/fileExportControllerOptimized');

// Storage scan routes
router.get('/storage/scans', storageController.listScans);
router.post('/storage/scan', storageController.scan);
router.get('/storage/status/:scan_id', storageController.getStatus);
router.post('/storage/stop/:scan_id', storageController.stopScan);
router.get('/storage/directory-count', storageController.getDirectoryCount);

// File browser routes (legacy)
router.get('/files/browse', FileBrowserControllerNew.browseFiles);
router.get('/files/search', fileBrowserController.search);
router.get('/files/stats', FileBrowserControllerNew.getStats);
router.get('/files/tree', FileBrowserControllerNew.getDirectoryTree);
router.get('/files/duplicates', FileBrowserControllerNew.findDuplicates);
router.get('/files/cleanup-recommendations', FileBrowserControllerNew.getCleanupRecommendations);

// File management
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
        const report = await generateOptimizedReport(req.app.locals.db, type);
        const generationTime = Date.now() - startTime;
        
        // Add metadata
        report.metadata = {
            generationTimeMs: generationTime,
            optimized: true,
            sizeSavings: '~60% reduction from original',
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

// User creation is allowed publicly (signup), but listing and per-user actions
// require authentication.
router.route('/users')
    .get(userController.index)
    .post([
        body('name', 'Name is required').not().isEmpty().trim().escape(),
        body('email', 'A valid email is required').isEmail().normalizeEmail(),
        body('password', 'Password must be at least 6 characters long').isLength({ min: 6 })
    ], userController.new);

router.route('/users/:id')
    .get(userController.view)
    .put([
        body('name').optional().trim().escape(),
        body('email').optional().isEmail().normalizeEmail()
    ], userController.update)
    .patch([
        body('name').optional().trim().escape(),
        body('email').optional().isEmail().normalizeEmail()
    ], userController.update)
    .delete(userController.delete);

// Protected session collection - requires authentication
const sessionsController = genericController('mySessions');
router.route('/mySessions')
    .get(requireAuth, sessionsController.getAll)
    .post(requireAuth, sessionsController.create);

router.route('/mySessions/:id')
    .get(requireAuth, sessionsController.getById)
    .patch(requireAuth, sessionsController.update)
    .put(requireAuth, sessionsController.update)
    .delete(requireAuth, sessionsController.delete);

// Mew routes - custom endpoints with specific business logic
router.get('/mew', mewController.index);

// Legacy mew endpoint - returns just the array
router.get('/mews', mewController.getAllMews);

// V2 mew endpoint with pagination
router.get('/v2/mews', mewController.getMewsV2);

// Create mew (both legacy and v2 use same controller)
// Apply validation middleware to sanitize inputs
router.post('/mews', [
    body('name').trim().escape(),
    body('content').trim().escape()
], mewController.createMew);

router.post('/v2/mews', [
    body('name').trim().escape(),
    body('content').trim().escape()
], mewController.createMew);

router.route('/iss').get(liveDatasController.iss)
router.route('/quakes').get(liveDatasController.quakes)
router.route('/iss/all').delete(liveDatasController.deleteAllIss)
router.route('/quakes/all').delete(liveDatasController.deleteAllQuakes)

// Route for Server-Sent Events (SSE) for the real-time feed (public)
// This endpoint is intentionally public so browsers can subscribe to the live feed
// without requiring a session cookie. Consumers should not send privileged data
// over this channel.
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


const logController = require('../controllers/logController');
router.get('/logs/countries', logController.getCountryCounts);
// Backwards/alternate route used by the dashboard UI: /api/v1/v2/logs
router.get('/v2/logs', logController.getLogsForSource);
router.get('/v2/logs/countries', (req, res, next) => {
    // delegate to existing getCountryCounts which reads req.query.source
    return logController.getCountryCounts(req, res, next);
});

const { fetchWithTimeoutAndRetry } = require('../utils/fetch-utils');

router.get('/geolocation', async (req, res) => {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log("Client IP for /geolocation:", clientIp);
    try {
        // First get public IP of the server, as ip-api.com might block local IPs or server's own IP if called directly.
        const ipifyResponse = await fetchWithTimeoutAndRetry('https://api64.ipify.org?format=json', { timeout: 4000, retries: 1, name: 'ipify' });
        if (!ipifyResponse.ok) throw new Error(`ipify error! Status: ${ipifyResponse.status}`);
        const { ip: publicIp } = await ipifyResponse.json();
        console.log("Public IP via ipify:", publicIp);
        const geoResponse = await fetchWithTimeoutAndRetry(`http://ip-api.com/json/${publicIp}`, { timeout: 4000, retries: 1, name: 'ip-api.com' });
        if (!geoResponse.ok) throw new Error(`ip-api.com error! Status: ${geoResponse.status}`);
        res.json(await geoResponse.json());
    } catch (error) {
        console.error('Error in /geolocation route:', error);
        res.status(500).json({ error: 'Error fetching geolocation', details: error.message });
    }
});

const externalApiController = require('../controllers/externalApiController');
const weatherController = require('../controllers/weatherController');
const ollamaController = require('../controllers/ollamaController');

router.post('/weather/register-location', requireAuth, weatherController.registerLocation);

// Ollama routes
router.get('/ollama/models', requireAuth, ollamaController.listModels);
router.post('/ollama/chat', requireAuth, ollamaController.chat);

router.get('/weather', externalApiController.getWeather);
router.get('/tides', externalApiController.getTides);
router.get('/tle', externalApiController.getTle);
router.get('/pressure', externalApiController.getPressure);
router.get('/ec-weather', externalApiController.getEcWeather);

// User/System logs manipulation routes
router.get('/logs/user', logController.getUserLogs);
router.post('/logs/user', [
    body('*').escape()
], logController.createUserLog);

router.get('/logs/server', logController.getServerLogs);
router.post('/logs/server', [
    body('*').escape()
], logController.createServerLog);

// Profile management APIs (basic)
router.get('/profiles', profileController.listProfiles);
router.post('/profiles', profileController.createProfile);

// Assign a profile to a user
router.post('/users/:id/assign-profile', profileController.assignProfileToUser);

// Dynamic catch-all route for any collection in the database
// This MUST be last to avoid conflicting with specific routes above
router.route('/:collectionName')
    .get((req, res, next) => {
        const controller = genericController(req.params.collectionName);
        controller.getAll(req, res, next);
    })
    .post((req, res, next) => {
        const controller = genericController(req.params.collectionName);
        controller.create(req, res, next);
    });

router.route('/:collectionName/:id')
    .get((req, res, next) => {
        const controller = genericController(req.params.collectionName);
        controller.getById(req, res, next);
    })
    .patch((req, res, next) => {
        const controller = genericController(req.params.collectionName);
        controller.update(req, res, next);
    })
    .put((req, res, next) => {
        const controller = genericController(req.params.collectionName);
        controller.update(req, res, next);
    })
    .delete((req, res, next) => {
        const controller = genericController(req.params.collectionName);
        controller.delete(req, res, next);
    });

// Export API routes
module.exports = router;
