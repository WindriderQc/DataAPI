const mdb = require('../mongooseDB')
const Device = require('../models/deviceModel')
const Heartbeat = require('../models/heartbeatModel')
const User = require('../models/userModel')
const Alarm = require('../models/alarmModel')
const Contact = require('../models/contactModel')
const Iss = require('../models/issModel')
const Quake = require('../models/quakeModel')



exports.countDocuments_ = async () => 
{
    let counts = {}
    counts["devices"] = await Device.countDocuments()
    counts["heartbeats"] = await Heartbeat.countDocuments()
    counts["users"] = await User.countDocuments()
    counts["alarms"] = await Alarm.countDocuments()
    counts["contacts"] = await Contact.countDocuments()
    counts["isses"] = await Iss.countDocuments()
    counts["quakes"] = await Quake.countDocuments()
    return counts
}


exports.index = async (req, res) => 
{
    Promise.all([
        this.countDocuments_(),
        mdb.getCollections()
    ])
    .then((counts, list) =>  res.json({  status: 'success',  message: 'Welcome to SBQC Data API  💻 🖱️ 🦾 ', data: { data: counts, Collections: list}   }))
    .catch(err =>  res.json({ status:'error', message: err}) )
}


exports.countDocuments = async (req, res) =>  
{
    countDocuments_()
    .then(counts =>  res.json({ status: "success", message: 'Documents counts retrieved successfully', data: counts  })   )
    .catch(err => res.json({ status:'error', message: err}))
}


exports.getCollectionList = async (req, res) => 
{
    mdb.getCollections()
    .then(list =>   res.json(list) )
    .catch(err => res.json({ status:'error', message: err}))
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


