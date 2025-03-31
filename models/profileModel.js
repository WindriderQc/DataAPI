const mongoose = require('mongoose')


const ProfileSchema = mongoose.Schema({
    profileName: {
        type: String, 
        default: "default_ESP32",
        required: true
    },
    id: {
        type: String, 
        required: true
    }, 
    config: {
        type: Array,
        default: [  
             { io: "34",  mode: "IN", lbl: "A2",  isA: "1", name: "" } 
            ,{ io: "39",  mode: "IN", lbl: "A3",  isA: "1", name: ""}
            ,{ io: "36", mode: "IN", lbl: "A4",  isA: "0", name: "" }
            ,{ io: "4", mode: "IN", lbl: "A5",  isA: "0", name: ""}
            ,{ io: "21", mode: "OUT", lbl: "D3",  isA: "0", name: "" }
            ,{ io: "13", mode: "OUT", lbl: "A12",  isA: "0", name: "BUILTINLED" }
            ,{ io: "14", mode: "IN", lbl: "D4",  isA: "0", name: "" }
            ,{ io: "15", mode: "IN", lbl: "D5",  isA: "0", name: "" }
            ,{ io: "35", mode: "IN", lbl: "D7",  isA: "0", name: ""} ]    
        }
})


const dbName = process.env.NODE_ENV === 'production' ? 'datas' : 'devdatas'
const myDB = mongoose.connection.useDb(dbName)

module.exports = myDB.model('Profile', ProfileSchema)

