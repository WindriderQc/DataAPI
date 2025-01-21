const mongoose = require('mongoose')


const DeviceSchema = mongoose.Schema({
    type: {
        type: String, 
        default: "esp32"
    },
    id: {
        type: String, 
        required: true
    },
    lastBoot: {
        type: Date, 
        default: Date.now()
    }, 
    zone: {
        type: String, 
        default: "bureau"
    },
    profileName:  {
        type: String, 
        default: "NO_CONFIG"
    },
    config: {
        type: Array,
        default: [{ io: "34",  mode: "IN", lbl: "A2",  isA: "1", name: "" } 
                 ,{ io: "36", mode: "IN", lbl: "A4",  isA: "0", name: "" }
                 ,{ io: "4", mode: "OUT", lbl: "A5",  isA: "1", name: "Fan" }
                 ,{ io: "13", mode: "OUT", lbl: "A12",  isA: "0", name: "BUILTINLED" }] 
    }
})

const myDB = mongoose.connection.useDb('datas')
module.exports = myDB.model('Device', DeviceSchema)

