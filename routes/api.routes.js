let router = require('express').Router()
const { body } = require('express-validator');
const genericController = require('../controllers/genericController');
const databasesController = require('../controllers/databasesController');
const liveDatasController = require('../controllers/liveDataController')
const { requireAuth } = require('../utils/auth');
const feedController = require('../controllers/feedController');

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

// Generic routes for collections
const collections = ['contacts', 'devices', 'profiles', 'heartbeats', 'alarms', 'checkins', 'mews'];
collections.forEach(collectionName => {
    const controller = genericController(collectionName);
    router.route(`/${collectionName}`)
        .get(controller.getAll)
        .post(controller.create);

    router.route(`/${collectionName}/:id`)
        .get(controller.getById)
        .patch(controller.update)
        .put(controller.update)
        .delete(controller.delete);
});

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

// Export API routes
module.exports = router;