
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
    
    let collection
        if (colName == "devices")    collection= Device
        if (colName == "hearbeats")  collection= Heartbeat
        if (colName == "users")      collection= User
        if (colName == "alarms")     collection= Alarm
        if (colName == "posts")      collection = Heartbeat
         else  collection= Device

    console.log("selecting:",colName, collection)
        return collection
      
}


module.exports = {      getCollection, countDocuments       }

