const router = require('express').Router();
const { requireAuth } = require('../utils/auth');

router.get('/', async (req, res) => {
    try {
        const dbs = req.app.locals.dbs;
        const users = await dbs.datas.collection('users').find().toArray();
        const devices = await dbs.datas.collection('devices').find().toArray();
        res.render('index', {
            users: users,
            devices: devices,
            alarms: [],
            title: "Dashboard", menuId: 'home', collectionInfo: req.app.locals.collectionInfo, regDevices: devices
        });
    } catch (err) {
        res.status(500).send(err);
    }
});

router.get('/tools', async (req, res) => {
    try {
        const dbs = req.app.locals.dbs;
        const users = await dbs.datas.collection('users').find().toArray();
        const devices = await dbs.datas.collection('devices').find().toArray();
        res.render('tools', {
            users: users,
            devices: devices,
            alarms: [],
            title: "Dashboard", menuId: 'home', collectionInfo: req.app.locals.collectionInfo, regDevices: devices
        });
    } catch (err) {
        res.status(500).send(err);
    }
});

router.get('/users', requireAuth, async (req, res) => {
    console.log('[ROUTES] GET /users: Handling request.');
    try {
        const dbs = req.app.locals.dbs;
        const users = await dbs.datas.collection('users').find().toArray();
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

module.exports = router;