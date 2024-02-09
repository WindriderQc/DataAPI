const Device = require('../models/deviceModel')


// Gets back all the devices
function index(req, res) {   
   // Device.find({}, (err, devices) => { errorCheck(err, res, { status: "success", message: 'Devices retrieved successfully', data: devices  })    })


    console.log("Requesting devices:", req.query)
    let { skip = 0, limit = 5, sort = 'desc' }  = req.query  //  http://192.168.0.33:3003/devices?skip=0&limit=25&sort=desc
    skip = parseInt(skip) || 0
    limit = parseInt(limit) || 10

    skip = skip < 0 ? 0 : skip;
    limit = Math.min(50, Math.max(1, limit))


    Promise.all([
        Device.countDocuments({}),
        Device.find({}, {}, { sort: {  created: sort === 'desc' ? -1 : 1  }      })
    ])
    .then(([ total, data ]) => {
        res.json({  status: "success", message: 'Devices retrieved successfully', 
                    data: data, 
                    meta: { total, sort, skip, limit, has_more: total - (skip + limit) > 0 }  
                })
    })  
    .catch(err => {  res.json({ status:'error', message: err, data: null}) }) 



}


//Get a  device  '/:id'
function readOne(req, res) {
    Device.find({ id: req.params.id }, (err, post) =>{ errorCheck(err, res, { status: "success", message: 'Device retrieved successfully', data: post  })      })   
}


// update  
function update(req, res) {

    const query = { id: req.body.id }
    const update = { type : req.body.type, lastBoot: req.body.lastBoot, connected: req.body.connected, config: req.body.config    }

    Device.findOneAndUpdate(query, update, { upsert: true, new: true, setDefaultsOnInsert: true }, (err, doc) => {
        errorCheck(err, res, { status: "success", message: 'Device registration Info updated/created', data: doc  }) 
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
    if (err) res.json({ status: "error", message: err, data: null }) 
    else     res.json(successMsg)    
}



/*
// Register new device
exports.new = (req, res) => {
    const device = new Device(req.body)
    device.save((err) =>{ errorCheck(err, res, { status: "success", message: 'Device registered successfully', data: device  })     })
}*/
