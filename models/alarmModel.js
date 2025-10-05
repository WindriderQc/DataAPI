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

// Use the primary database name from the centralized configuration
const mainDbConnection = mongoose.connection.useDb(config.db.mainDb, { useCache: true });

module.exports = mainDbConnection.model('Alarms', AlarmSchema);