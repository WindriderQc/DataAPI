const mongoose = require('mongoose')


let _db
let _connection

const mongooseDB = {

    


    init: async function(selectedDatabase, callback) {
        
        const url =  "mongodb://" + process.env.USER + ":" + process.env.PASSWORD + "@127.0.0.1:27017/" + selectedDatabase + "?retryWrites=true&w=majority&authMechanism=DEFAULT&authSource=admin"
        //const url = process.env.MONGO_URL ? process.env.MONGO_URL : "mongodb://127.0.0.1:27017/IoT"   //  attempt at local database if no cloud URL defined, prevent crash if no .env file is found nor url defined

        // mongoose with local DB
        mongoose.connect( url,  { family: 4, useNewUrlParser: true, useUnifiedTopology: true }, (err)=>{ if (err)  console.log("Error at Mongoose Connect:  "+ url + "\n" + err)}) // family: 4 -> skip  default IPV6 connection  and accelerate connection.

        mongoose.connection.on('error', console.error.bind(console, 'conn error:'))

        mongoose.connection.once('open', async () =>  { 
         
            console.log('\nMongoose connected to:', selectedDatabase, "\n", url, "\n" )  

            _db = mongoose.connection.db
            _connection = mongoose.connection

            if(callback) callback() 
        })
    }, 


    getCollections: async function() {
          
        const col = await _db.listCollections().toArray() 
        
        return (col) //module.exports.Collections = col;
    },

    changeDb: function(dbName) {
        const newDbConnection = _connection.useDb(dbName)
        _db = newDbConnection.db
    },

    getDb: function() {

        return _db
    },

    getCollection: function() {
        return collection_
    }

}

module.exports = mongooseDB