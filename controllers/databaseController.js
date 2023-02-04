
const Device = require('../models/deviceModel')
const Heartbeat = require('../models/heartbeatModel')
const User = require('../models/userModel')
const Alarm = require('../models/alarmModel')

async function countDocuments(req, res) {
    let counts = []
    counts["devices"] = await Device.countDocuments()
    counts["heartbeats"] = await Heartbeat.countDocuments()
    counts["users"] = await User.countDocuments()
    counts["alarms"] = await Alarm.countDocuments()
 
    console.log(counts)
    res.json(counts)
}

function getCollection(colName) {
    
    console.log( colName)
    let collection
        if (colName == "devices")    collection = Device
        else if (colName == "heartbeats")  collection = Heartbeat
        else if (colName == "users")      collection = User
        else if (colName == "alarms")     collection = Alarm
        //else if (colName == "posts")      collection = posts
        else  collection = Device

    console.log("selecting:",colName, collection)
        return collection
      
}

/*function getCollectionsName(req, res) {
    
    router.get('/database/collectionList',  (req, res) => {
        const list = mdb.getCollections()
        console.log('Sending collection list to client: ', JSON.parse(list))
        res.json( list)
    })
}*/

module.exports = {      getCollection, countDocuments       }

