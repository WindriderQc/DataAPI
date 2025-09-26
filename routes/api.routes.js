let router = require('express').Router()
const { body } = require('express-validator');

const Device = require('../models/deviceModel')
const Heartbeat = require('../models/heartbeatModel')
const User = require('../models/userModel')
const Alarm = require('../models/alarmModel')


// A default API response to check if the API is up
router.get('/', (req, res) => {
    res.json({
        status: 'API Its Working',
        message: 'Welcome to the DataAPI!',
    });
});







const databaseController = require('../controllers/databaseController')

router.route("/db").get(databaseController.index)
router.route("/db/collectionList").get(databaseController.getCollectionList)
router.route("/db/countDocuments").get(databaseController.countDocuments)






const contactController = require('../controllers/contactController')

router.route('/contacts')
    .get(contactController.index)
    .post(
        body('name').notEmpty().withMessage('Name is required.'),
        body('email').isEmail().withMessage('Please provide a valid email address.'),
        contactController.new
    )

router.route('/contacts/:contact_id')
    .get(contactController.view)
    .patch(
        body('email').optional().isEmail().withMessage('Please provide a valid email address.'),
        contactController.update
    )
    .put(
        body('email').optional().isEmail().withMessage('Please provide a valid email address.'),
        contactController.update
    )
    .delete(contactController.delete)

const userController = require('../controllers/userController')
router.get('/users-page', userController.renderUsersPage);

router.route('/users')
    .get(userController.index)
    .post(
        body('name').notEmpty().withMessage('Name is required.'),
        body('email').isEmail().withMessage('Please provide a valid email address.'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
        userController.new
    );

router.route('/users/login').post(
    body('email').isEmail().withMessage('Please provide a valid email address.'),
    body('password').notEmpty().withMessage('Password is required.'),
    userController.login
);


router.route('/users/fromEmail/:email').get(userController.fromEmail)

router.route('/users/:user_id')
    .get(userController.view)
    .patch(
        body('email').optional().isEmail().withMessage('Please provide a valid email address.'),
        userController.update
    )
    .put(
        body('email').optional().isEmail().withMessage('Please provide a valid email address.'),
        userController.update
    )
    .delete(userController.delete)



    
const deviceController = require('../controllers/deviceController')

router.route('/devices')
    .get(deviceController.index)
    .delete(deviceController.deleteAll);

router.route('/devices/:id')
    .get(deviceController.readOne)
    .patch(
        body('payload').notEmpty().withMessage('Payload is required.'),
        deviceController.update
    )   //  use patch instead of post which will create or update
    .delete(deviceController.deleteOne)

const profileController = require('../controllers/profileController')

router.route('/profiles')
    .get(profileController.index)
    .delete(profileController.deleteAll);

router.route('/profiles/:profileName')
    .get(profileController.getFromProfileName)
    .patch(
        body('content').notEmpty().withMessage('Content is required.'),
        profileController.update
    )
    .delete(profileController.deleteOne)

const heartbeatController = require('../controllers/heartbeatController')

router.route('/heartbeats')
    .get(heartbeatController.index)
    .post(
        body('sender').notEmpty().withMessage('Sender is required.'),
        body('type').notEmpty().withMessage('Type is required.'),
        heartbeatController.new
    )
    .delete(heartbeatController.deleteAll);

router.route('/heartbeats/:post_id')
    .get(heartbeatController.byId)
    .delete(heartbeatController.delete)

router.route('/heartbeats/senders').get(heartbeatController.sendersDistinct)
router.route('/heartbeats/senderLatest/:esp').get(heartbeatController.senderLatest)
router.route('/heartbeats/senderOldest/:esp').get(heartbeatController.senderOldest)
router.route('/heartbeats/data/:options').get(heartbeatController.data)




const alarmController = require('../controllers/alarmController')

router.route('/alarms')
    .get(alarmController.index)
    .post(
        body('espID').notEmpty().withMessage('espID is required.'),
        body('io').notEmpty().withMessage('io is required.'),
        alarmController.post
    )
    .patch(
        body('enabled').isBoolean().withMessage('enabled must be a boolean.'),
        alarmController.update
    )

router.route('/alarms/by-esp-io').get(alarmController.getEspIO);
router.route('/alarms/:espID').get(alarmController.getbyEsp)

 




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
    // let skip = Number(req.query.skip) || 0
    // let limit = Number(req.query.limit) || 10
    let { skip = 0,  sort = 'desc', source = 'userLogs' } = req.query
    skip = parseInt(skip) || 0


    skip = skip < 0 ? 0 : skip;
    console.log("wanting:",source,  req.app.locals.collections)
    const logsdb =  req.app.locals.collections[source]
    console.log('Getting logs from DB namespace', logsdb.namespace)

    Promise.all([
        logsdb.countDocuments(),
        logsdb.find({}, { skip, sort: {  created: sort === 'desc' ? -1 : 1     } }).toArray()
    ])
    .then(([ total, logs ]) => {
        res.json({
        logs,
        meta: { total, skip, source, has_more: 0, } })
    })
    .catch(next)
}


const createUserLog = async (req, res, next) => {
    if (req.body) {
        const log = req.body
        log.created =  new Date()
        console.log(log)
        const logsdb =  req.app.locals.collections.userLogs;
    try{
        const createdLog = await logsdb.insertOne(log)
        console.log(
        `UserLog document was inserted with the _id: ${createdLog.insertedId}`,
        )
        res.json(createdLog)
    }
    catch(err) {console.log(err); next() }

    } else {
        res.status(422)
        res.json({
        message: 'Hey! Invalid log....'
        })
    }
}


function requestLog(req) {

    let client = req.headers['user-agent'];
    let content = req.headers['Content-Type'];
    let authorize = req.headers['Authorization'];
    let origin = req.headers['host'];
    let ip = req.socket.remoteAddress;

    let queryParams = req.query; // Query parameters
    let path = req.path; // Path of the request URL
    let method = req.method; // HTTP method
    let protocol = req.protocol; // Protocol (HTTP or HTTPS)
    let hostname = req.hostname; // Hostname of the request
    let originalUrl = req.originalUrl; // Original URL of the request
    let cookies = req.cookies; // Cookies sent by the client (if any)   const cookieParser = require('cookie-parser');      app.use(cookieParser());


    const log = {
        logType: 'checkin',
        client: client ? client.toString().trim() : 'none',
        content: content ? content.toString().trim() : 'none',
        authorization: authorize ? authorize.toString().trim() : 'none',
        host: origin ? origin.toString().trim() : 'none',
        ip: ip ? ip.toString().trim() : 'none',
        hitCount: counter.getCount(),
        created: new Date(),
        queryParams: queryParams ? JSON.stringify(queryParams) : 'none',
        path: path ? path.toString().trim() : 'none',
        method: method ? method.toString().trim() : 'none',
        protocol: protocol ? protocol.toString().trim() : 'none',
        hostname: hostname ? hostname.toString().trim() : 'none',
        originalUrl: originalUrl ? originalUrl.toString().trim() : 'none',
        cookies: cookies ? JSON.stringify(cookies) : 'none'
    }

    return log
}


router.get('/v2/logs', getUserLogs)
router.post('/v2/logs', createUserLog)


///////////////////////////////////////////////////////////////////////////////

// Export API routes
module.exports = router

///////////////////////////////////////////////////////////////////////////////