const router = require('express').Router()
const fetch = require('node-fetch')
const mdb = require('../mongooseDB')

const apiUrl = process.env.API_URL


// Set default API response
router.get('/', function (req, res) {  res.json({  status: 'Data server active',  message: 'Welcome to SBQC Data API  💻 🖱️ 🦾', data: { APIs: "Alarms, Contact, Devices, heartbeat, users" }   })   })


let selectedCollection = "devices"

router.get('/database/list', async (req, res, next) => {
    // let skip = Number(req.query.skip) || 0
    // let limit = Number(req.query.limit) || 10
    let { skip = 0, limit = 5, sort = 'desc' , collection = selectedCollection} = req.query  //  http://192.168.0.33:3001/server/list?skip=0&limit=25&sort=desc&collection=users
    skip = parseInt(skip) || 0
    limit = parseInt(limit) || 5

    skip = skip < 0 ? 0 : skip;
    limit = Math.min(50, Math.max(1, limit))

    if(collection == "")   collection = selectedCollection
    else  selectedCollection = collection

    console.log("WANTED", req.query, collection)
 
    const list = mdb.getCollections()
    const db =  list[collection]
    //console.log(db)
//  TODO  :  crash si le nom de la collection n'Existe pas dans la BD, ou si il n'y a pas de post dans la collection.
    if(!db) res.json({})
    else {     

        Promise.all([
            db.countDocuments(),
            db.find({}, {
                skip,
                limit,
                sort: {  created: sort === 'desc' ? -1 : 1     }
            }).toArray()
        ])
        .then(([ total, data ]) => {
            res.json({
            data,
            meta: {
                total,
                skip,
                limit,
                has_more: total - (skip + limit) > 0,
            }
            })
        }).catch(next)  

    }
})


router.get('/database/collectionList',  (req, res) => {
    const list = mdb.getCollections()
    console.log('Sending collection list to client: ', JSON.parse(list))
    res.json( list)
})

module.exports = router;