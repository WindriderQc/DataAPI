const Alarm = require('../models/alarmModel')

exports.index = async (req, res) => {

    try{
        const alarms = await Alarm.find()
        res.json(alarms)
        //res.json({
        //    status: "success",
        //    message: "Alarms retrieved successfully",
        //    data: alarms
        //})
    }catch(err) {
        res.json({ status: "error", message:err })
    }
}


exports.post = async (req, res) => {

    
    try {
        const als = await Alarm.updateOne({ espID: req.body.espID, io: req.body.io },   // Query parameter
                                        {   // Replacement document                  
                                            tStart:  req.body.tStart,
                                            tStop: req.body.tStop
                                        },
                                        { upsert: true }      // Will create a new document if alarmIO doesnt exist
                                    )
   
       
                
        console.log("Updated Alarm:\n")
        console.log(als)
        res.json(als )
       /* res.json({
                status: 'Success',
                message: 'Alarm Info updated',
                data: als 
        })*/
    } 
    catch (error) {  res.json(error)   }     

}



exports.update =  (req, res) => {
    Alarm.find({espID: req.body.espID, io: req.body.io}, (err, alarm) => {
        if (err) res.send(err)

        alarm.start = req.body.start
        alarm.stop = req.body.stop
        alarm.save( (err) => {
            if (err)
                res.json(err);
            res.json({
                message: 'Alarm updated',
                data: alarm
            })
        })
    })
}


exports.getbyEsp =  (req, res) => {
    Alarm.find({espID: req.params.espID}, (err, ioAlarms) => {
        if (err) res.send(err)
        res.json(ioAlarms) 
    })
}


exports.getEspIO =  (req, res) => {
    Alarm.find({espID: req.params.espID, io: req.params.io}, (err, alarm) => {
        if (err) res.send(err)
        res.json(alarm)
    })
}

exports.getAll = async () => {
    try{
        const alarms = await Alarm.find()
        return alarms
       
    }catch(err) {
        return { status: "error", message:err }
    }
}