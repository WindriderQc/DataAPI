const Profiles = require('../models/profileModel')


// Gets back all the devices
function index(req, res) {   
    Profiles.find({}, (err, post) =>{ errorCheck(err, res, { status: "success", message: 'All Profiles retrieved successfully', data: post  })      })   
}


//Get a  specific  '/:id'
function readOne(req, res) {
    Profiles.find({ id: req.params.id }, (err, post) =>{ errorCheck(err, res, { status: "success", message: 'ProfilesConfig retrieved successfully from ID', data: post  })      })   
}


//Get a  specific  '/:profileName'
function getFromProfileName(req, res) {
    Profiles.find({ profileName: req.params.profileName }, (err, post) =>{ errorCheck(err, res, { status: "success", message: 'Profile Config retrieved successfully from Name', data: post  })      })   
}


// update a specific  '/:id'
function update(req, res) {
    const query = { id: req.body.id }
    const update = { profileName : req.body.profileName, config: req.body.config    }

    Profiles.findOneAndUpdate(query, update, { upsert: true, new: true, setDefaultsOnInsert: true }, (err, doc) => {
        errorCheck(err, res, { status: "success", message: 'ProfilesConfig updated/created', data: doc  }) 
    })
}


//Delete a specific  '/:id' 
function deleteOne(req, res) {
    Profiles.deleteOne({ id: req.params.id }, (err, ack) => { errorCheck(err, res, { status: "success", message: 'ProfilesConfig ' + id + ' deleted', data: ack  })     })
}


// delete all collection
function deleteAll(req, res) { 
    Profiles.deleteMany({}, (err, ack) => { errorCheck(err, res, { status: "success", message: 'All ProfilesConfig deleted', data: ack  })      })
}


///////////////////////////////////////////////////////////////////////////////////////


module.exports = {      index,      readOne,    getFromProfileName,    update,     deleteOne,      deleteAll       }


///////////////////////////////////////////////////////////////////////////////////////
// helper method
errorCheck = (err, res, successMsg) =>{
    if (err) res.json({ status: "error", message: err, data: null }) 
    else     res.json(successMsg)    
}