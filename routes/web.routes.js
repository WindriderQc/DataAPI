const router = require('express').Router();
const User = require('../models/userModel');
const Device = require('../models/deviceModel');

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

module.exports = router;
