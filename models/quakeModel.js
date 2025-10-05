const mongoose = require('mongoose')


const QuakeSchema = mongoose.Schema({
    time: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    depth: { type: Number, required: true },
    mag: { type: Number },
    magType: { type: String },
    nst: { type: Number },
    gap: { type: Number },
    dmin: { type: Number },
    rms: { type: Number },
    net: { type: String },
    id: { type: String, required: true, unique: true },
    updated: { type: String },
    place: { type: String },
    type: { type: String },
    horizontalError: { type: Number },
    depthError: { type: Number },
    magError: { type: Number },
    magNst: { type: Number },
    status: { type: String },
    locationSource: { type: String },
    magSource: { type: String }
});

const config = require('../config/config');

// Use the dataDb name from the centralized configuration
const dataDbConnection = mongoose.connection.useDb(config.db.dataDb, { useCache: true });

module.exports = dataDbConnection.model('Quake', QuakeSchema);