const mongoose = require('mongoose')


const IssSchema = mongoose.Schema({
    longitude: {
        type: Number, 
        default: "0.000000000000",
        required: true
    },
    latitude: {
        type: Number, 
        default: "0.000000000000",
        required: true
    },
    timeStamp: {
        type: Date, 
        required: true
    }
})

const config = require('../config/config');

// Use the dataDb name from the centralized configuration
const dataDbConnection = mongoose.connection.useDb(config.db.dataDb, { useCache: true });

module.exports = dataDbConnection.model('Iss', IssSchema);

