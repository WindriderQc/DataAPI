const express = require('express')
const cors = require('cors')
require('dotenv').config();
const mdb = require('./mongooseDB')

const liveDatas = require('./scripts/liveData.js')

const PORT = process.env.PORT || 3003 


async function startDatabase() 
{
    const dbName = process.env.NODE_ENV === 'production' ? 'datas' : 'devdatas'
    const mongourl = process.env.MONGO_URL + dbName + process.env.MONGO_OPTIONS  // MONGO_URL=mongodb+srv://user:pasword@cluster0-xxxxx.mongodb.net/     //   MONGO_OPTIONS=?retryWrites=true&w=majority&authSource=admin
    
    try {
        await mdb.init(mongourl, dbName, async ()=>{    console.log("Collections: ", await mdb.getCollections())   })
       
        const app = express()
        app.set('view engine', 'ejs')
    
        //Middlewares & routes
        app
            .use(cors({    origin: '*',    optionsSuccessStatus: 200  }  ))
            .use(express.urlencoded({extended: true, limit: '10mb'}))  //  Must be before  'app.use(express.json)'    , 10Mb to allow image to be sent
            .use(express.json({limit:'10mb'})) // To parse the incoming requests with JSON payloads
            //.use(rateLimit({ windowMs: 30 * 1000, max: 1 }))  //  prevents a user to crash server with too many request, altough with ESP32 sending heartbeat fast.. this cannot be set
            .use('/', require("./routes/api.routes"))
            .listen(PORT, () => {
                console.log(`\n\nData API Server running at port ${PORT}`)    
                liveDatas.init()
                console.log("LiveData  -  v" + liveDatas.version) 
        })

       

    } catch (err) {
        console.log('Failed to initialize database:', err)
    }

}

startDatabase()





