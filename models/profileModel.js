const mongoose = require('mongoose')


const ProfileSchema = mongoose.Schema({
    profileName: {
        type: String, 
        default: "default_ESP32",
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


const config = require('../config/config');

// Use the primary database name from the centralized configuration
const mainDbConnection = mongoose.connection.useDb(config.db.mainDb, { useCache: true });

module.exports = mainDbConnection.model('Profile', ProfileSchema);

