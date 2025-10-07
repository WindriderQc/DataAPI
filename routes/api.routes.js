let router = require('express').Router()
const { body } = require('express-validator');
const genericController = require('../controllers/genericController');
const databasesController = require('../controllers/databasesController');
const feedController = require('../controllers/feedController');
const { requireAuth } = require('../utils/auth');

// A default API response to check if the API is up
router.get('/', (req, res) => {
    res.json({
        status: 'API Its Working',
        message: 'Welcome to the DataAPI!',
    });
});

const userController = require('../controllers/userController');

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
const collections = ['contacts', 'devices', 'profiles', 'heartbeats', 'alarms'];
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

const liveDatasController = require('../controllers/liveDataController')
router.route('/iss').get(liveDatasController.iss)
router.route('/quakes').get(liveDatasController.quakes)
router.route('/iss/all').delete(liveDatasController.deleteAllIss)
router.route('/quakes/all').delete(liveDatasController.deleteAllQuakes)

// Route for Server-Sent Events (SSE) for the real-time feed
router.get('/feed/events', requireAuth, feedController.sendFeedEvents);

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
router.get('/v2/logs/countries', logController.getCountryCounts);





const { fetchWithTimeoutAndRetry } = require('../utils/fetch-utils');

router.get('/proxy-location', async (req, res) => {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log("Client IP for proxy-location:", clientIp); // Added more specific log
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
        console.error('Error in /proxy-location route:', error);
        res.status(500).json({ error: 'Error fetching geolocation', details: error.message });
    }
});

// User/System logs manipulation routes

router.get('/v2/logs', logController.getUserLogs);
router.post('/v2/logs', [
    // Sanitize all fields in the body to prevent XSS.
    // The escape() sanitizer will only apply to string fields, leaving others untouched.
    body('*').escape()
], logController.createUserLog);

// Export API routes
module.exports = router