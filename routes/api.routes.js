let router = require('express').Router()

const Device = require('../models/deviceModel')
const Heartbeat = require('../models/heartbeatModel')
const User = require('../models/userModel')
const Alarm = require('../models/alarmModel')


// Set route default response
router.get('/', async function (req, res) { 

   res.redirect('/db')

})





const databaseController = require('../controllers/databaseController')

router.route("/db").get(databaseController.index)
router.route("/db/collectionList").get(databaseController.getCollectionList)
router.route("/db/countDocuments").get(databaseController.countDocuments)






const contactController = require('../controllers/contactController')

router.route('/contacts')
    .get(contactController.index)
    .post(contactController.new)

router.route('/contacts/:contact_id')
    .get(contactController.view)
    .patch(contactController.update)
    .put(contactController.update)
    .delete(contactController.delete)





const { body } = require('express-validator');
const userController = require('../controllers/userController')

router.route('/users')
    .get(userController.index)
    .post(
        body('name').notEmpty().withMessage('Name is required.'),
        body('email').isEmail().withMessage('Please provide a valid email address.'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
        userController.new
    )


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

router.route('/device/:id')
    .get(deviceController.readOne)
    .patch(deviceController.update)   //  use patch instead of post which will create or update
    .delete(deviceController.deleteOne)

const profileController = require('../controllers/profileController')

router.route('/profiles')
    .get(profileController.index)
    .delete(profileController.deleteAll);

router.route('/profile/:profileName')
    .get(profileController.getFromProfileName)
    .patch(profileController.update)
    .delete(profileController.deleteOne)

const heartbeatController = require('../controllers/heartbeatController')

router.route('/heartbeats')
    .get(heartbeatController.index)
    .post(heartbeatController.new)
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
    .post(alarmController.post)  
    .patch(alarmController.update)

router.route('/alarms/:espID,io').get(alarmController.getEspIO)
router.route('/alarms/:espID').get(alarmController.getbyEsp)

 




const liveDatasController = require('../controllers/liveDataController')
router.route('/iss').get(liveDatasController.iss)
router.route('/quakes').get(liveDatasController.quakes)
router.route('/iss/all').delete(liveDatasController.deleteAllIss)
router.route('/quakes/all').delete(liveDatasController.deleteAllQuakes)
router.route('/zonann').get(liveDatasController.zonann)


///////////////////////////////////////////////////////////////////////////////

// Export API routes
module.exports = router

///////////////////////////////////////////////////////////////////////////////