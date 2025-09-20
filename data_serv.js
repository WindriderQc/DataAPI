const express = require('express')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
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

        //Middlewares & routes
        app
            .use(cors({    origin: '*',    optionsSuccessStatus: 200  }  ))
            .use(express.urlencoded({extended: true, limit: '10mb'}))  //  Must be before  'app.use(express.json)'    , 10Mb to allow image to be sent
            .use(express.json({limit:'10mb'})) // To parse the incoming requests with JSON payloads
            .use(rateLimit({
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 100, // Limit each IP to 100 requests per windowMs
                standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
                legacyHeaders: false, // Disable the `X-RateLimit-*` headers
            }))
            .use('/', require("./routes/api.routes"))

        // Global error handler middleware
        app.use((err, req, res, next) => {
            console.error(err.stack);
            res.status(500).json({
                status: 'error',
                message: 'An internal server error occurred.',
                // In development, you might want to send the error stack
                // error: process.env.NODE_ENV === 'development' ? err.stack : undefined
            });
        });

        app.listen(PORT, () => {
            console.log(`\n\nData API Server running at port ${PORT}`)
            liveDatas.init()
            console.log("LiveData  -  v" + liveDatas.version)
        })

    } catch (err) {
        console.log('Failed to initialize database:', err)
    }

}

startDatabase()
