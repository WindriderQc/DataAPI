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

router.get('/frontend', async (req, res) => {
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

router.route('/alarms/:espID,io').get(alarmController.getEspIO)
router.route('/alarms/:espID').get(alarmController.getbyEsp)

 




const liveDatasController = require('../controllers/liveDataController')
router.route('/iss').get(liveDatasController.iss)
router.route('/quakes').get(liveDatasController.quakes)
router.route('/iss/all').delete(liveDatasController.deleteAllIss)
router.route('/quakes/all').delete(liveDatasController.deleteAllQuakes)


///////////////////////////////////////////////////////////////////////////////

// Export API routes
module.exports = router

///////////////////////////////////////////////////////////////////////////////