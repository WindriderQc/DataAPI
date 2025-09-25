const router = require('express').Router();
const User = require('../models/userModel');
const Device = require('../models/deviceModel');
const { requireAuth } = require('../utils/auth');

router.get('/', async (req, res) => {
    try {
        const users = await User.find();
        const devices = await Device.find();
        res.render('index', {
            users: users,
            devices: devices,
            alarms: []
        });
    } catch (err) {
        res.status(500).send(err);
    }
});

router.get('/users', requireAuth, async (req, res) => {
    console.log('[ROUTES] GET /users: Handling request.');
    try {
        const users = await User.find();
        console.log(`[ROUTES] GET /users: Found ${users.length} users. Rendering page.`);
        res.render('users', {
            users: users,
            title: 'User Management'
        });
    } catch (err) {
        console.error('[ROUTES] GET /users: Error:', err);
        res.status(500).send(err);
    }
});

module.exports = router;
