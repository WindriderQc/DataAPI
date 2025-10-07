const mongoose = require('mongoose');
const config = require('../config/config');

const appEventSchema = new mongoose.Schema({
    message: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        required: true,
        enum: ['info', 'warning', 'error', 'success', 'user', 'device', 'userLog'],
        default: 'info'
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
});

// Use the singleton mongoose.connection which is established at startup.
// This assumes mongoose.connect() has been called elsewhere.
const mainDbConnection = mongoose.connection.useDb(config.db.mainDb, { useCache: true });

// Export the compiled model directly.
module.exports = mainDbConnection.model('AppEvent', appEventSchema);