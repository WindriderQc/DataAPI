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
    connected: {
        type: Boolean,
        default: false   
    },
    lastBoot: {
        type: Date, 
        default: Date.now()
    }, 
    zone: {
        type: String, 
        default: "bureau"
    }, 
    config: {
        type: Array,
        default: [  
                 { io: "34",  mode: "IN", lbl: "A2",  isA: "1", name: "" } 
                ,{ io: "39",  mode: "IN", lbl: "A3",  isA: "1", name: "" }
                ,{ io: "36", mode: "IN", lbl: "A4",  isA: "0", name: "" }
                ,{ io: "4", mode: "OUT", lbl: "A5",  isA: "1", name: "Fan" }
                ,{ io: "21", mode: "OUT", lbl: "D3",  isA: "0", name: "Lamp 1" }     
                ,{ io: "14", mode: "OUT", lbl: "D4",  isA: "0", name: "Lamp 2" }
                ,{ io: "15", mode: "OUT", lbl: "D5",  isA: "0", name: "Pump" }
                ,{ io: "13", mode: "OUT", lbl: "D6",  isA: "0", name: "Heat" }
                ,{ io: "35", mode: "IN", lbl: "D7",  isA: "0", name: "" } 
                ,{ io: "13", mode: "OUT", lbl: "A12",  isA: "0", name: "BUILTINLED" }  ] 
        }
})

const myDB = mongoose.connection.useDb('iGrow')
module.exports = myDB.model('Device', DeviceSchema)

