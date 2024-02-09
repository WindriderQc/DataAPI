const mongoose = require('mongoose')

const databaseName = "iGrow"
const url =  "mongodb://" + process.env.USER + ":" + process.env.PASSWORD + "@127.0.0.1:27017/" + databaseName + "?retryWrites=true&w=majority&authMechanism=DEFAULT&authSource=admin"
//const url = process.env.MONGO_URL ? process.env.MONGO_URL : "mongodb://127.0.0.1:27017/IoT"   //  attempt at local database if no cloud URL defined, prevent crash if no .env file is found nor url defined

let _db

const mongooseDB = {

    
    init: async function(callback) {
        
        // mongoose with local DB
        mongoose.connect( url,  { family: 4, useNewUrlParser: true, useUnifiedTopology: true }, (err)=>{ if (err)  console.log("Error at Mongoose Connect:  "+ url + "\n" + err)}) // family: 4 -> skip  default IPV6 connection  and accelerate connection.

        mongoose.connection.on('error', console.error.bind(console, 'conn error:'))

        mongoose.connection.once('open', async () =>  { 
         
            console.log('\nMongoose connected to:', databaseName, "\n", url, "\n" )  

            _db = mongoose.connection.db;

            if(callback) callback() 
        })
    }, 

    getCollections: async function() {
        //return JSON.stringify(_collections)
        console.log('Getting collections.... ')
        const col = await _db.listCollections().toArray() 
        //module.exports.Collections = col;
        return (col)
    }

}

module.exports = mongooseDB