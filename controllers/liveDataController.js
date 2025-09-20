const Iss = require('../models/issModel')
const Quake = require('../models/quakeModel')
const liveData = require('../scripts/liveData')





exports.quakes = async (req, res)=> 
{   
    Promise.all([ 
        Quake.countDocuments(),  
        Quake.find({}) 
    ])
    .then(([c, quakes]) =>  res.json({  status: "success", message: 'Quakes retrieved successfully',  meta: { count: c },  data: quakes } ))
    .catch(err => {  res.json({ status:'error', message: err, data: null}) }) 
}


exports.iss = (req, res) => 
{
    Promise.all([
        Iss.countDocuments({}),
        Iss.find({}, {}, { sort: {  created: -1  }      })
    ])
    .then(([ total, data ]) => res.json({  status: "success", message: 'Iss locations retrieved successfully',  meta: { total },   data:   data  }))  
    .catch(err => {  res.json({ status:'error', message: err, data: null}) })  
}


exports.deleteAllIss = (req, res) => 
{ 
    Iss.deleteMany({})
    .then( ack => { res.json({ status: "success", message: 'All Iss deleted', data: ack  })    })
    .catch( err => { res.json({ status:'error', message: err}) })
}


exports.deleteAllQuakes = (req, res) => 
{  
    Quake.deleteMany({})
    .then( ack =>  res.json({ status: "success", message: 'All Quakes deleted', data: ack  }) )
    .catch( err =>  res.json({ status:'error', message: err}))
}

exports.zonann = async (req, res) =>
{
    try {
        const temps = await liveData.getZonAnn();
        if (temps) {
            res.json({ status: "success", message: 'Zonal Annual Means retrieved successfully', data: temps });
        } else {
            res.status(500).json({ status: "error", message: 'Failed to fetch temperature data' });
        }
    } catch (error) {
        res.status(500).json({ status: "error", message: 'An error occurred while fetching temperature data', details: error.message });
    }
}