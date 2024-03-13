const mongoose = require('mongoose')


const IssSchema = mongoose.Schema({
    longitude: {
        type: Number, 
        default: "0.000000000000",
        required: true
    },
    latitude: {
        type: Number, 
        default: "0.000000000000",
        required: true
    },
    timeStamp: {
        type: Date, 
        required: true
    }
})

const myDB = mongoose.connection.useDb('datas')

module.exports = myDB.model('Iss', IssSchema)

