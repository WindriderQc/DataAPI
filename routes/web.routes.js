const router = require('express').Router();
const { requireAuth } = require('../utils/auth');
const { log } = require('../utils/logger');
const config = require('../config/config');
const mqttClient = require('../scripts/mqttClient');

// Middleware to load common data for dashboard-like pages
const loadDashboardData = async (req, res, next) => {
    try {
        const dbs = req.app.locals.dbs;
        const dbName = config.db.defaultDbName;
        res.locals.users = await dbs[dbName].collection('users').find().toArray();
        res.locals.devices = await dbs[dbName].collection('devices').find().toArray();
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
        regDevices: res.locals.devices
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
        const dbs = req.app.locals.dbs;
        const dbName = config.db.modelDbName;
        const users = await dbs[dbName].collection('users').find().toArray();
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

router.get('/live-data', requireAuth, (req, res) => {
    res.render('live-data', {
        title: 'Live Data',
        user: res.locals.user, // Pass user to the template
        appVersion: req.app.locals.appVersion
    });
});

router.get('/live-data/iss', (req, res) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const client = mqttClient.getClient();

    const messageHandler = (topic, message) => {
        if (topic === config.mqtt.issTopic) {
            const data = message.toString();
            res.write(`data: ${data}\n\n`);
        }
    };

    if (client && client.connected) {
        client.subscribe(config.mqtt.issTopic, (err) => {
            if (err) {
                log(`[SSE] Failed to subscribe to topic ${config.mqtt.issTopic}: ${err}`, 'error');
                return res.status(500).end();
            }
            log(`[SSE] Client subscribed to topic: ${config.mqtt.issTopic}`);
            client.on('message', messageHandler);
        });
    } else {
        log('[SSE] MQTT client not available or not connected.', 'error');
        return res.status(500).send('MQTT client not available');
    }

    // Handle client disconnect
    req.on('close', () => {
        log('[SSE] Client disconnected.');
        if (client) {
            client.removeListener('message', messageHandler);
            // Unsubscribing here might not be ideal if other clients are connected.
            // For this simple case, we assume one listener per connection.
            // A more robust solution would manage subscriptions more carefully.
            client.unsubscribe(config.mqtt.issTopic, (err) => {
                if (err) {
                    log(`[SSE] Error unsubscribing from topic ${config.mqtt.issTopic}: ${err}`, 'error');
                } else {
                    log(`[SSE] Client unsubscribed from topic: ${config.mqtt.issTopic}`);
                }
            });
        }
        res.end();
    });
});

module.exports = router;