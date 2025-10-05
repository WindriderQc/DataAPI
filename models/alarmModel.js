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

const config = require('../config/config');

// Use the dataDb name from the centralized configuration
const dataDbConnection = mongoose.connection.useDb(config.db.dataDb, { useCache: true });

module.exports = dataDbConnection.model('Alarms', AlarmSchema);