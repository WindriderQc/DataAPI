const Device = require('../models/deviceModel')


// Gets back all the devices
function index(req, res) {   
   // Device.find({}, (err, devices) => { errorCheck(err, res, { status: "success", message: 'Devices retrieved successfully', data: devices  })    })


   // console.log("Requesting devices:", req.query)
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
async function readOne(req, res) {
    try {
        const post = await Device.find({ id: req.params.id });
        res.json({ status: "success", message: 'Device retrieved successfully', data: post });
    } catch (err) {
        res.json({ status: "error", message: err, data: null });
    }
}


// update  
async function update(req, res) {
    const query = { id: req.body.id };
    const update = { type: req.body.type, lastBoot: req.body.lastBoot, connected: req.body.connected, config: req.body.config  };

    try {
        const doc = await Device.findOneAndUpdate(query, update, { upsert: true,  new: true, setDefaultsOnInsert: true });
        res.status(200).json({ status: "success", message: 'Device registration Info updated/created', data: doc });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
}


//Delete a specific device
async function deleteOne(req, res) {
    try {
        const ack = await Device.deleteOne({ id: req.params.id });
        res.json({ status: "success", message: 'Device ' + req.params.id + ' deleted', data: ack });
    } catch (err) {
        res.json({ status: "error", message: err, data: null });
    }
}


// delete all the posts
async function deleteAll(req, res) { 
    try {
        const ack = await Device.deleteMany({});
        res.json({ status: "success", message: 'All registered Devices deleted', data: ack });
    } catch (err) {
        res.json({ status: "error", message: err, data: null });
    }
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
