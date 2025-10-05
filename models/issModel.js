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

// Use the primary database name from the centralized configuration
const mainDbConnection = mongoose.connection.useDb(config.db.mainDb, { useCache: true });

module.exports = mainDbConnection.model('Iss', IssSchema);

