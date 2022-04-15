const express = require('express')
const cors = require('cors')
require('dotenv').config();
const mdb = require('./mongooseDB') // mongoose with local DB

const IN_PROD = process.env.NODE_ENV === 'production'  // for https channel...  IN_PROD will be true if in production environment
const PORT = process.env.PORT || 5000


const app = express()
app.set('view engine', 'ejs')


mdb.init(()=>{
    console.log(mdb.getCollections())
})


//Middlewares & routes
app
    .use(cors({    origin: '*',    optionsSuccessStatus: 200  }  ))
    .use(express.urlencoded({extended: true, limit: '10mb'}))  //  Must be before  'app.use(express.json)'    , 10Mb to allow image to be sent
    .use(express.json({limit:'10mb'})) // To parse the incoming requests with JSON payloads
    //.use(rateLimit({ windowMs: 30 * 1000, max: 1 }))  //  prevents a user to crash server with too many request, altough with ESP32 sending heartbeat fast.. this cannot be set
    .use('/', require("./routes/main.routes"))
    .use('/api', require("./routes/api.routes"))
    .listen(PORT, () => { 
        console.log(`\n\nData API Server running in ${process.env.NODE_ENV} mode at port ${PORT}`)
    })