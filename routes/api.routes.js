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





const userController = require('../controllers/userController')

router.post("/users/test", async (req, res) => {
    console.log("test");
    res.header("auth-test", "yoyo").send("test good");  //  testing custom header    //  TODO :  finish test and clean up! :)
    })

router.route('/users')
    .get(userController.index)
    .post(userController.new)  


router.route('/users/fromEmail/:email').get(userController.fromEmail)

router.route('/user/:user_id')
    .get(userController.view)
    .patch(userController.update)
    .put(userController.update)
    .delete(userController.delete)



    
const deviceController = require('../controllers/deviceController')

router.route('/devices')
    .get(deviceController.index)

router.route('/device/:id')
    .get(deviceController.readOne)
    .patch(deviceController.update)   //  use patch instead of post which will create or update
    .delete(deviceController.deleteOne)

router.route('/devices/deleteAll').get(deviceController.deleteAll)    





const profileController = require('../controllers/profileController')

router.route('/profiles').get(profileController.index)
router.route('/profileFromName/:profileName').get(profileController.getFromProfileName)

router.route('/profile/:id')
    .get(profileController.readOne)
    .patch(profileController.update)
    .delete(profileController.deleteOne)

router.route('/profiles/deleteAll').get(profileController.deleteAll)    




const heartbeatController = require('../controllers/heartbeatController')

router.route('/heartbeats')
    .get(heartbeatController.index)
    .post(heartbeatController.new)

router.route('/heartbeats/deleteAll').get(heartbeatController.deleteAll)    
router.route('/heartbeats/senders').get(heartbeatController.sendersDistinct)
router.route('/heartbeats/senderLatest/:esp').get(heartbeatController.senderLatest)
router.route('/heartbeats/senderOldest/:esp').get(heartbeatController.senderOldest)
router.route('/heartbeats/data/:options').get(heartbeatController.data)

router.route('/heartbeats/:post_id')
    .get(heartbeatController.byId)
    .delete(heartbeatController.delete)





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
router.route('/deleteAllIss').get(liveDatasController.deleteAllIss)
router.route('/deleteAllQuakes').get(liveDatasController.deleteAllQuakes)   


///////////////////////////////////////////////////////////////////////////////

// Export API routes
module.exports = router

///////////////////////////////////////////////////////////////////////////////