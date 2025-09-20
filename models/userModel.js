const mongoose = require('mongoose')

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true,
        max: 1024,
        min: 6
    },
    lat: {
        type: Number,
        required: false
    },
    lon: {
        type: Number,
        required: false
    },
    creationDate: {
        type: Date,
        required: false,
        default: Date.now
    },
    lastConnectDate: {
        type: Date,
        required: false,
        default: Date.now
    }

})


const dbName = process.env.NODE_ENV === 'production' ? 'datas' : 'devdatas'
const myDB = mongoose.connection.useDb(dbName)

let User = module.exports = myDB.model('user', userSchema)
module.exports.get =  (callback, limit) =>  User.find(callback).limit(limit)