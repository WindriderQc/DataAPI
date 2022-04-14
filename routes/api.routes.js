let router = require('express').Router()

// Set route default response
router.get('/', function (req, res) {    res.json({        status: 'dbServ API active',        message: 'Welcome to SBQC API'    })})


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
    res.header("auth-test", "yoyo").send("test good");  //  testing custom header 
    })

router.route('/users')
    .get(userController.index)
    .post(userController.new)  

router.route('/users/:user_id')
    .get(userController.view)
    .patch(userController.update)
    .put(userController.update)
    .delete(userController.delete)


    
const deviceController = require('../controllers/deviceController')

router.route('/devices')
    .get(deviceController.index)
 //   .post(deviceController.new)  //  use patch instead which will create or update

router.route('/devices/:id')
    .get(deviceController.readOne)
    .patch(deviceController.update)
    .delete(deviceController.deleteOne)

router.route('/devices/deleteAll').get(deviceController.deleteAll)    



const heartbeatController = require('../controllers/heartbeatController')

router.route('/heartbeats')
    .get(heartbeatController.index)
    .post(heartbeatController.new)

router.route('/heartbeats/deleteAll').get(heartbeatController.deleteAll)    
router.route('/heartbeats/devices').get(heartbeatController.devices)
router.route('/heartbeats/deviceLatest/:esp').get(heartbeatController.deviceLatest)
router.route('/heartbeats/deviceOldest/:esp').get(heartbeatController.deviceOldest)
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








// Export API routes
module.exports = router