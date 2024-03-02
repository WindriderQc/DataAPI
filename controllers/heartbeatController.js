const Heartbeat = require('../models/heartbeatModel')


// Gets back all the posts
exports.index = (req, res)=> {   

    console.log("Requesting:", req.query)
    let { skip = 0, limit = 5, sort = 'desc' }  = req.query  //  http://192.168.0.33:3003/heartbeats?skip=0&limit=25&sort=desc
    skip = parseInt(skip) || 0
    limit = parseInt(limit) || 10

    skip = skip < 0 ? 0 : skip;
    limit = Math.min(50, Math.max(1, limit))


    Promise.all([
        Heartbeat.countDocuments({}),
        Heartbeat.find({}, {}, { sort: {  created: sort === 'desc' ? -1 : 1  }      })
    ])
    .then(([ total, data ]) => {
        res.json({  status: "success", message: 'Heartbeats retrieved successfully', 
                    data: data, 
                    meta: { total, sort, skip, limit, has_more: total - (skip + limit) > 0 }  
                })
    })  
    .catch(err => {  res.json({ status:'error', message: err, data: null}) })  

}


//Get a  post  '/:post_id'
exports.byId = (req, res) => {
    Heartbeat.findById(req.params.post_id, (err, post) =>{
        console.log()
        if (err)  res.json({ status:'error', message: err})
        res.json({ status: "success", message: 'Heartbeat retrieved successfully', data: post  })
    })   
}


// Submits a post
exports.new = (req, res) => {

    const post = new Heartbeat(req.body)

    post.save((err) =>{
        if (err)  res.json({ status:'error', message: err})
        res.json({ status: "success", message: 'Heartbeat loggged successfully', data: post  })
    })
}


//Delete a specific post
exports.delete = (req, res) => {
   
    Heartbeat.deleteOne({ _id: req.params.post_id }, (err, ack) => {
        if (err)  res.json({ status:'error', message: err})
        res.json({ status: "success", message: 'Post deleted', data: ack  })
        })
}


// delete all the posts
exports.deleteAll = (req, res) => { 
  
    Heartbeat.deleteMany({}, (err, ack) => {
        if (err)  res.json({ status:'error', message: err})
        res.json({ status: "success", message: 'All Heartbeats deleted', data: ack  })
        })

}


// get list of all devices that posted 
exports.sendersDistinct = (req, res) => {   

    Heartbeat.distinct('sender', (err, devices) => {
        if (err)  res.json({ status:'error', message: err})
        res.json({ status: "success", message: 'Latest heartbeaters retrieved', data: devices  })
    })     
}


// get last post for a specific device
exports.senderLatest = async (req, res) => {
    try {
        const latest = await Heartbeat.find({"sender": req.params.esp}).sort({ _id: -1 }).limit(1)
        res.json({ status: "success", message: 'Latest heartbeat retreived', data: latest  })
    } 
    catch (err) {  res.json({ status:'error', message: err})  }
}


// get first post for a specific device
exports.senderOldest = async (req, res) => {
    try {
        const oldest = await Heartbeat.find({"sender": req.params.esp}).sort({ _id: 1 }).limit(1)
        res.json({ status: "success", message: 'Oldest heartbeat retreived', data: oldest  })
    }
    catch (err) { res.json({ message: err })  }
}



// get a data sample via params
exports.data = async (req, res) => {

    const options = req.params.options.split(',')
    console.log(options)
    const ratio = Number(options[0])
    const espID = options[1]
    const startDate = options[2]
    const opt = { ratio, espID, startDate }


    try {
        const data = await Heartbeat.find({ sender: espID, time: { $gt: startDate } }).sort({ time: 1 }).limit(50000)
   
        let ret = [];

        for (let i = 0, len = data.length; i < len; i++) {
            if (i % ratio === 0) {
                ret.push(data[i]);
            }
        }

        console.log("\nSending data...")
        res.json({ status: "success", message: `Data with options ${JSON.stringify(opt)} retreived`, data: ret  })
    }
    catch (err) {  res.json({ status:'error', message: err})  }
}
