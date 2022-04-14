const mongoose = require('mongoose')


const DeviceSchema = mongoose.Schema({
    type: {
        type: String, 
        default: "esp32",
        required: true
    },
    id: {
        type: String, 
        required: true
    },
    configName: {
        type: String, 
        default: "default"
    },
    connected: {
        type: Boolean,
        default: false   
    },
    lastBoot: {
        type: Date, 
        default: Date.now()
    }
})


module.exports = mongoose.model('Device', DeviceSchema)

