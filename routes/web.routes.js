const router = require('express').Router();
const { requireAuth } = require('../utils/auth');
const { log } = require('../utils/logger');
const config = require('../config/config');
const databasesController = require('../controllers/databasesController');
const feedController = require('../controllers/feedController');

// Middleware to load common data for dashboard-like pages
const loadDashboardData = async (req, res, next) => {
    try {
    const dbs = req.app.locals.dbs;
    // Access collections from their respective databases
    res.locals.users = await dbs.mainDb.collection('users').find().toArray();
    res.locals.devices = await dbs.mainDb.collection('devices').find().toArray();
    res.locals.feedData = await feedController.getFeedData(dbs);
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
        collectionInfo: req.app.locals.collectionInfo,
        regDevices: res.locals.devices
    });
});

router.get('/users', requireAuth, async (req, res, next) => {
    log('[ROUTES] GET /users: Handling request.');
    try {
    // Use the main application database connection directly
    const db = req.app.locals.dbs.mainDb;
        const users = await db.collection('users').find().toArray();
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

router.get('/live-data',  (req, res) => {
    // Normalize broker URL so frontend receives a ws:// or wss:// URL regardless of env var scheme
    let brokerUrl = config.mqtt.brokerUrl || '';
    brokerUrl = brokerUrl.trim();
    // Convert mqtt:// -> ws://, mqtts:// -> wss://, http:// -> ws://, https:// -> wss://
    brokerUrl = brokerUrl.replace(/^mqtt:\/\//i, 'ws://')
                       .replace(/^mqtts:\/\//i, 'wss://')
                       .replace(/^http:\/\//i, 'ws://')
                       .replace(/^https:\/\//i, 'wss://');

    const mqttConfig = {
        brokerUrl,
        issTopic: config.mqtt.issTopic,
        username: config.mqtt.username,
        password: config.mqtt.password
    };
    res.render('live-data', {
        title: 'Live Data',
        user: res.locals.user,
        appVersion: req.app.locals.appVersion,
        mqttConfig: JSON.stringify(mqttConfig)
    });
});

module.exports = router;