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

const dbName = process.env.NODE_ENV === 'production' ? 'datas' : 'devdatas'
const myDB = mongoose.connection.useDb(dbName)

module.exports = myDB.model('Alarms', AlarmSchema)