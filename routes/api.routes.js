let router = require('express').Router()
const { body } = require('express-validator');
const genericController = require('../controllers/genericController');

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
    .post(userController.new);

router.route('/users/:id')
    .get(userController.view)
    .put(userController.update)
    .patch(userController.update)
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





router.get('/proxy-location', async (req, res) => {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log("Client IP for proxy-location:", clientIp); // Added more specific log
    try {
        // First get public IP of the server, as ip-api.com might block local IPs or server's own IP if called directly.
        const ipifyResponse = await fetch('https://api64.ipify.org?format=json');
        if (!ipifyResponse.ok) throw new Error(`ipify error! Status: ${ipifyResponse.status}`);
        const { ip: publicIp } = await ipifyResponse.json();
        console.log("Public IP via ipify:", publicIp);

        const geoResponse = await fetch(`http://ip-api.com/json/${publicIp}`);
        if (!geoResponse.ok) throw new Error(`ip-api.com error! Status: ${geoResponse.status}`);
        res.json(await geoResponse.json());
    } catch (error) {
        console.error('Error in /proxy-location route:', error);
        res.status(500).json({ error: 'Error fetching geolocation', details: error.message });
    }
});

//  User/System logs manipulation functions


const getUserLogs = async (req, res, next) => {
    let { skip = 0, sort = 'desc', source = 'userLogs', db = 'SBQC' } = req.query;
    skip = parseInt(skip) || 0;
    skip = skip < 0 ? 0 : skip;

    const dbs = req.app.locals.dbs;
    if (!dbs || !dbs[db]) {
        return res.status(500).json({ error: `Database '${db}' not found.` });
    }
    const logsdb = dbs[db].collection(source);

    Promise.all([
        logsdb.countDocuments(),
        logsdb.find({}, { skip, sort: { created: sort === 'desc' ? -1 : 1 } }).toArray()
    ])
    .then(([total, logs]) => {
        res.json({
            logs,
            meta: { total, skip, source, db, has_more: 0 }
        });
    })
    .catch(next);
};

const createUserLog = async (req, res, next) => {
    if (req.body) {
        const log = req.body;
        log.created = new Date();

        const { db = 'SBQC', source = 'userLogs' } = req.query;
        const dbs = req.app.locals.dbs;

        if (!dbs || !dbs[db]) {
            return res.status(500).json({ error: `Database '${db}' not found.` });
        }

        const logsdb = dbs[db].collection(source);
        try {
            const createdLog = await logsdb.insertOne(log);
            console.log(`Log document was inserted with the _id: ${createdLog.insertedId}`);
            res.json(createdLog);
        } catch (err) {
            console.log(err);
            next(err);
        }
    } else {
        res.status(422).json({
            message: 'Hey! Invalid log....'
        });
    }
};


router.get('/v2/logs', getUserLogs)
router.post('/v2/logs', createUserLog)

// Export API routes
module.exports = router