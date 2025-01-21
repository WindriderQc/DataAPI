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

const myDB = mongoose.connection.useDb('datas')
module.exports = myDB.model('Alarms', AlarmSchema)