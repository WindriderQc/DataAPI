const mongoose = require('mongoose');

const hardwareSchema = new mongoose.Schema({
    os: String,
    model: String,
    type: String, // 'server', 'workstation', 'mobile', etc.
    vendor: String
}, { _id: false });

const networkDeviceSchema = new mongoose.Schema({
    mac: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    ip: {
        type: String,
        required: true
    },
    hostname: {
        type: String,
        default: ''
    },
    vendor: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['online', 'offline'],
        default: 'offline'
    },
    firstSeen: {
        type: Date,
        default: Date.now
    },
    lastSeen: {
        type: Date,
        default: Date.now
    },
    ipHistory: [{
        ip: String,
        timestamp: { type: Date, default: Date.now }
    }],
    hardware: hardwareSchema,
    alias: {
        type: String,
        default: ''
    },
    location: {
        type: String,
        default: ''
    },
    notes: {
        type: String,
        default: ''
    },
    openPorts: [{
        port: Number,
        protocol: String,
        service: String,
        state: String
    }]
}, {
    timestamps: true
});

// Index for faster lookups
networkDeviceSchema.index({ mac: 1 });
networkDeviceSchema.index({ ip: 1 });
networkDeviceSchema.index({ status: 1 });

const createNetworkDeviceModel = (connection) => {
    if (connection.models.NetworkDevice) {
        return connection.models.NetworkDevice;
    }
    return connection.model('NetworkDevice', networkDeviceSchema);
};

module.exports = {
    networkDeviceSchema,
    createNetworkDeviceModel
};
