const Device = require('../models/deviceModel')


// Gets back all the devices
function index(req, res) {   
    Device.find({}, (err, devices) => { errorCheck(err, res, { status: "success", message: 'Devices retrieved successfully', data: devices  })    })
}


//Get a  device  '/:id'
function readOne(req, res) {
    Device.find({ id: req.params.id }, (err, post) =>{ errorCheck(err, res, { status: "success", message: 'Device retrieved successfully', data: post  })      })   
}


// update  
function update(req, res) {

    const query = { id: req.body.id }
    const update = { type : req.body.type, configName : req.body.configName, lastBoot: req.body.lastBoot    }

    Device.findOneAndUpdate(query,update, { upsert: true, new: true, setDefaultsOnInsert: true }, (err, doc) => {
        errorCheck(err, res, { message: 'Device registration Info updated/created', data: doc  }) 
    })
}


//Delete a specific device
function deleteOne(req, res) {
    Device.deleteOne({ id: req.params.id }, (err, ack) => { errorCheck(err, res, { status: "success", message: 'Device ' + id + ' deleted', data: ack  })     })
}


// delete all the posts
function deleteAll(req, res) { 
    Device.deleteMany({}, (err, ack) => { errorCheck(err, res, { status: "success", message: 'All registered Devices deleted', data: ack  })      })
}


///////////////////////////////////////////////////////////////////////////////////////
module.exports = {      index,      readOne,    update,     deleteOne,      deleteAll       }

// helper method
errorCheck = (err, res, successMsg) =>{
    if (err) res.json({ status: "error", message: err }) 
    else     res.json(successMsg)    
}



/*
// Register new device
exports.new = (req, res) => {
    const device = new Device(req.body)
    device.save((err) =>{ errorCheck(err, res, { status: "success", message: 'Device registered successfully', data: device  })     })
}*/
