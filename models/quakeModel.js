const mongoose = require('mongoose')


const QuakeSchema = mongoose.Schema({
    time: {
        type: String, 
        required: true
    },
    latitude: {
        type: Number, 
        default: "0.0",
        required: true
    },
    longitude: {
        type: Number, 
        default: "0.0",
        required: true
    },
    depth: {
        type: Number, 
        default: "0.0",
        required: true
    },
    mag: {
        type: Number, 
        default: "0.0",
       
    }

})

const myDB = mongoose.connection.useDb('datas')

module.exports = myDB.model('Quake', QuakeSchema)