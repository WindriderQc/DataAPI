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
       
    },
    magType: {
        type: String
    },
    place: {
        type: String
    },
    type: {
        type: String
    },
    status: {
        type: String
    },
    locationSource: {
        type: String
    },
    magSource: {
        type: String
    }
})

const dbName = process.env.NODE_ENV === 'production' ? 'datas' : 'devdatas'
const myDB = mongoose.connection.useDb(dbName)

module.exports = myDB.model('Quake', QuakeSchema)