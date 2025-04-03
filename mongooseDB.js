const mongoose = require('mongoose')


let _db
let _connection

const mongooseDB = {

    


    init: async function(url, selectedDatabase, callback) {
        
        mongoose.connect( url,  { family: 4 }) // family: 4 -> skip  default IPV6 connection  and accelerate connection.

        mongoose.connection.on('error', console.error.bind(console, 'conn error:'))

        mongoose.connection.once('open', async () =>  { 
         
            const db = mongoose.connection.useDb(selectedDatabase);
            console.log('\nMongoose connected to:', db.name, "\n", url, "\n" )  

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