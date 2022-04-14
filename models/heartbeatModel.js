const mongoose = require('mongoose')

//  {"sender":"ESP_35030","time":"2020-10-02 13:26:53","CPUtemp":"47.78","wifi":"-54" , ...}

const HeartbeatSchema = mongoose.Schema({
    sender: {
        type: String, 
        required: true
    },
    time: {
        type: Date, 
        default: Date.now,
        required: true
    },
    CPUtemp: {
        type: Number,
        default: 0.0
    },
    wifi: {
        type: Number,
        default: 0
    },
    battery: {
        type: Number,
        default: 0.0
    },
    co2: {
        type: Number,
        default: 0
    },
    smoke: {
        type: Number,
        default: 0
    },
    lpg: {
        type: Number,
        default: 0
    },
    tempBM_280: {
        type: Number,
        default: 0.0
    },
    pressure: {
        type: Number,
        default: 0.0
    },
    altitude: {
        type: Number,
        default: 0.0
    },
    airHumid: {
        type: Number,
        default: 0
    },
    tempDht: {
        type: Number,
        default: 0.0
    },
    ir: {
        type: Number,
        default: 0.0
    },
    full: {
        type: Number,
        default: 0.0
    },
    visible: {
        type: Number,
        default: 0.0
    },
    lux: {
        type: Number,
        default: 0.0
    }
})


module.exports = mongoose.model('Heartbeat', HeartbeatSchema)

