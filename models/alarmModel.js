const mongoose = require('mongoose')

const AlarmSchema = mongoose.Schema({
    espID: {
        type: String, 
        required: true
    },
    io: {
        type: Number, 
        required: true
    },
    tStart: {
        type: Date, 
        required: true
    },
    tStop: {
        type: Date,
        required: true
    }

})


module.exports = mongoose.model('Alarms', AlarmSchema)