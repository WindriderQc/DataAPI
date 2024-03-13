//  Mongoose has more functionality but requires rigid data model, while native mongodb driver does not restrict data model

const mongoClient = require("mongodb").MongoClient


const mongo = {
    connectDb: (url, dbName, callback) => 
    {            
        mongoClient.connect(url,  { useNewUrlParser: true, useUnifiedTopology: true })//  TODO  passer l'URL en param pour enlever dépendance a dotenv
        .then(client =>{
            
        
            client.db().admin().listDatabases().then(dbs => {
                console.log('\nMongoDB client connected to db: ' + url + '\nDatabases:')  
                console.log(dbs.databases)
                console.log()
            })

            this.db = client.db(dbName);

            callback(this.db)
        })

      
    },
    
    getCollectionsList:  async () => 
    {
        try {
            const collInfos =  await this.db.listCollections().toArray() 
            return collInfos
        } 
        catch(e) { console.log(e) }
       
    },
    
    getDb: (collectionToGet) => 
    {
        return this.db.collection(collectionToGet)
    }
    
}

module.exports = mongo