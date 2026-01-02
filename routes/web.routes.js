const router = require('express').Router();
const { requireAuth } = require('../utils/auth');
const { requireAdmin } = require('../utils/auth');
const { log } = require('../utils/logger');
const config = require('../config/config');
const databasesController = require('../controllers/databasesController');
const feedController = require('../controllers/feedController');
const liveData = require('../scripts/liveData');

const normalizeBsonForView = (value) => {
    if (value === null || value === undefined) {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map(normalizeBsonForView);
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (value && typeof value === 'object') {
        if (value._bsontype === 'ObjectID' && typeof value.toString === 'function') {
            return value.toString();
        }

        return Object.keys(value).reduce((acc, key) => {
            acc[key] = normalizeBsonForView(value[key]);
            return acc;
        }, {});
    }

    return value;
};

// Middleware to load common data for dashboard-like pages
const loadDashboardData = async (req, res, next) => {
    try {
        const dbs = req.app.locals.dbs;
        // Access collections from their respective databases
        res.locals.users = await dbs.mainDb.collection('users').find().toArray();
        res.locals.devices = await dbs.mainDb.collection('devices').find().toArray();
        res.locals.feedData = await feedController.getFeedData();
        res.locals.latestEmailStat = null;

        const sbqcDb = dbs.sbqcDb || (req.app.locals.mongoClient ? req.app.locals.mongoClient.db('SBQC') : null);
        if (res.locals.user && res.locals.user.isAdmin && sbqcDb) {
            try {
                const latestEmail = await sbqcDb
                    .collection('emailStats')
                    .find()
                    .sort({ createdAt: -1, updatedAt: -1, timestamp: -1, _id: -1 })
                    .limit(1)
                    .toArray();
                res.locals.latestEmailStat = latestEmail[0] ? normalizeBsonForView(latestEmail[0]) : null;
            } catch (emailErr) {
                console.warn('Failed to load email stats for tools view:', emailErr && emailErr.message ? emailErr.message : emailErr);
                res.locals.latestEmailStat = null;
            }
        }
        // If the user is authenticated, provide the raw feed (full AppEvent objects)
        // so the dashboard can show stacks/extra info for admin debugging.
        if (res.locals.user) {
            try {
                res.locals.rawFeed = await feedController.getRawFeedData();
            } catch (e) {
                // don't break the dashboard if raw feed fails
                res.locals.rawFeed = [];
                console.warn('Failed to load raw feed for dashboard:', e && e.message ? e.message : e);
            }
        }
        next();
    } catch (err) {
        next(err); // Pass errors to the global error handler
    }
};

router.get('/', loadDashboardData, (req, res) => {
    res.render('index', {
        users: res.locals.users,
        devices: res.locals.devices,
        alarms: [],
        title: "Dashboard",
        menuId: 'home',
        collectionInfo: req.app.locals.collectionInfo,
        regDevices: res.locals.devices,
        feedData: res.locals.feedData
    });
});

router.get('/tools', requireAuth, loadDashboardData, (req, res) => {
    res.render('tools', {
        users: res.locals.users,
        devices: res.locals.devices,
        alarms: [],
        title: "Dashboard",
        menuId: 'home',
        user: res.locals.user,
        collectionInfo: req.app.locals.collectionInfo,
        regDevices: res.locals.devices,
        latestEmailStat: res.locals.latestEmailStat
    });
});

router.get('/storage-tool', requireAuth, (req, res) => {
    res.render('storage-tool', {
        title: "Storage Scanner",
        menuId: 'storage-tool',
        user: res.locals.user,
        appVersion: require('../package.json').version
    });
});

router.get('/network-scanner', requireAuth, (req, res) => {
    res.render('network-scanner', {
        title: "Network Scanner",
        menuId: 'tools', // Keeping menuId generic for highlighting
        user: res.locals.user,
        appVersion: require('../package.json').version
    });
});

router.get('/file-browser', requireAuth, (req, res) => {
    const title = "File Browser";
    res.render('file-browser', {
        title,
        user: res.locals.user,
        env: config.env
    });
});

// NOTE: n8n integration and AI Control Board have been moved to AgentX.
// If you need these features, access them via AgentX at http://localhost:3080/ai-control.html

router.get('/users', requireAuth, async (req, res, next) => {
    log('[ROUTES] GET /users: Handling request.');
    try {
        // Use the main application database connection directly
        const db = req.app.locals.dbs.mainDb;
        let users = await db.collection('users').find().toArray();
        // Normalize IDs to strings for safe client-side usage in templates
        users = users.map(u => {
            return Object.assign({}, u, {
                _id: u._id ? String(u._id) : u._id,
                profileId: u.profileId ? String(u.profileId) : null
            });
        });
        log(`[ROUTES] GET /users: Found ${users.length} users. Rendering page.`);
        res.render('users', {
            users: users,
            title: 'User Management'
        });
    } catch (err) {
        log(`[ROUTES] GET /users: Error: ${err}`, 'error');
        next(err);
    }
});

router.get('/databases', requireAuth, databasesController.getDatabasesPage);

/*
router.get('/dashboard', async (req, res) => {
    console.log('Getting registered Esp32')
    const registered = await esp32.getRegistered()
    if(registered == null) {
        console.log('Could not fetch devices list. Is DataAPI online?')
        res.redirect('/index')
    } else {
        console.log(registered.map((dev) => id = dev.id ))
        res.render('dashboard', { title: "Dashboard", menuId: 'home', hitCount: await counter.getCount(), collectionInfo: req.app.locals.collectionInfo, regDevices: registered })
    }
})
*/

router.get('/live-data', (req, res) => {
    // Get current service state from liveData script
    const serviceState = liveData.getServiceState();
    
    // Normalize broker URL so frontend receives a ws:// or wss:// URL regardless of env var scheme
    let brokerUrl = config.mqtt.brokerUrl || '';
    brokerUrl = brokerUrl.trim();
    // Convert mqtt:// -> ws://, mqtts:// -> wss://, http:// -> ws://, https:// -> wss://
    brokerUrl = brokerUrl.replace(/^mqtt:\/\//i, 'ws://')
        .replace(/^mqtts:\/\//i, 'wss://')
        .replace(/^http:\/\//i, 'ws://')
        .replace(/^https:\/\//i, 'wss://');

    // Only provide broker URL if master switch AND at least one MQTT-dependent service is enabled
    const mqttNeeded = serviceState.liveDataEnabled && (serviceState.iss || serviceState.weather);

    const mqttConfig = {
        enabled: mqttNeeded, // Add explicit enabled flag for frontend
        brokerUrl: mqttNeeded ? brokerUrl : null,
        issTopic: serviceState.iss ? config.mqtt.issTopic : null,
        username: config.mqtt.username,
        password: config.mqtt.password,
        pressureTopic: null,
        serviceState // Include service state so frontend knows what's enabled
    };

    if (serviceState.weather) {
        if (res.locals.user && res.locals.user.lat && res.locals.user.lon) {
            mqttConfig.pressureTopic = `${config.mqtt.pressureTopic}/${res.locals.user.lat},${res.locals.user.lon}`;
        } else {
            // Default to Quebec City for non-logged-in users
            mqttConfig.pressureTopic = `${config.mqtt.pressureTopic}/46.8138,-71.208`;
        }
    }

    res.render('live-data', {
        title: 'Live Data',
        user: res.locals.user,
        appVersion: req.app.locals.appVersion,
        mqttConfig: JSON.stringify(mqttConfig)
    });
});

// Admin-only full feed view.
router.get('/admin-feed', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const rawFeed = await feedController.getRawFeedData();
        res.render('admin-feed', {
            title: 'Admin Feed',
            user: res.locals.user,
            rawFeed: JSON.stringify(rawFeed || []),
            menuId: 'admin-feed',
            chatkitAgentId: process.env.CHATKIT_AGENT_ID || null
        });
    } catch (err) {
        next(err);
    }
});

// Admin-only endpoint to trigger a test error so the global error handler
// captures stack and emits it to the private feed. Uses POST to avoid CSRF
// via simple GET navigation. Protected by requireAdmin.
router.post('/admin/trigger-error', requireAuth, requireAdmin, (req, res, next) => {
    // Intentionally throw an error to exercise the global error handler
    try {
        throw new Error('Test error triggered by admin. Stack should be captured.');
    } catch (err) {
        // Pass to the global error handler
        next(err);
    }
});

module.exports = router;