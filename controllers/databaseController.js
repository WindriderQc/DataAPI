
const mdb = require('../mongooseDB')
const Device = require('../models/deviceModel')
const Heartbeat = require('../models/heartbeatModel')
const User = require('../models/userModel')
const Alarm = require('../models/alarmModel')


async function index(req, res) {

    let counts = {}
    counts["devices"] = await Device.countDocuments()
    counts["heartbeats"] = await Heartbeat.countDocuments()
    counts["users"] = await User.countDocuments()
    counts["alarms"] = await Alarm.countDocuments()
    
    const list = await mdb.getCollections()

    res.json({ status: "success", message: 'Database API reached.', data: counts, list  })
}

async function countDocuments(req, res) {
    let counts = {}
    counts["devices"] = await Device.countDocuments()
    counts["heartbeats"] = await Heartbeat.countDocuments()
    counts["users"] = await User.countDocuments()
    counts["alarms"] = await Alarm.countDocuments()
 
    console.log("Counting Documents:", counts)
    
    //if (err)  res.json({ status:'error', message: err})
    res.json({ status: "success", message: 'Documents counts retrieved successfully', data: counts  })
}

async function getCollectionList(req, res) {
    const list = await mdb.getCollections()
    console.log('Sending collection list to client: ', list)
    res.json( list)
}

/*
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
      
}*/

module.exports = {  index, countDocuments, getCollectionList       }

