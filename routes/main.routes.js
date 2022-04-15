const router = require('express').Router()
const fetch = require('node-fetch')
const mdb = require('../mongooseDB')

const databaseController = require('../controllers/databaseController')

// Set default API response
router.get('/', function (req, res) {  res.json({  status: 'Data server active',  message: 'Welcome to SBQC Data API  💻 🖱️ 🦾', data: { APIs: "Alarms, Contact, Devices, heartbeat, users" }   })   })


let selectedCollection = "heartbeats"

router.get('/database/list', async (req, res, next) => {
    // let skip = Number(req.query.skip) || 0
    // let limit = Number(req.query.limit) || 10
    let { skip = 0, limit = 5, sort = 'desc' , collection = selectedCollection} = req.query  //  http://192.168.0.33:3001/server/list?skip=0&limit=25&sort=desc&collection=users
    skip = parseInt(skip) || 0
    limit = parseInt(limit) || 5

    skip = skip < 0 ? 0 : skip;
    limit = Math.min(50, Math.max(1, limit))

    // select preconfigured collection if none are queried otherwise update selectedCollection for future use
    if(collection == "")   collection = selectedCollection
    else  selectedCollection = collection

    console.log("WANTED", req.query, collection)
 
    const db = databaseController.getCollection(collection)
    db.find({},null,{ skip, limit, sort: {  created: sort === 'desc' ? -1 : 1  } }, (err, data)=>{
        if(err) console.log(err)

        console.log(data)
    })
    console.log(db)

    db.countDocuments({}, (err, data) => {
        if(err) console.log(err)
        console.log('Documents count: ', data)
     
    })

   /* const list = mdb.getCollections()
    console.log(list)
   
*/
//  TODO  :  crash si le nom de la collection n'Existe pas dans la BD, ou si il n'y a pas de post dans la collection.
    if(!db) res.json({status: "error", message: "collection not found"})
    else {     

        Promise.all([
            db.countDocuments({}),
            db.find({}, {}, {
                skip,    //  TODO :   check car bug si skip = 0. ( juste quand il y a un seul doc dans collection ou tjrs??  )
                limit, 
                sort: {  created: sort === 'desc' ? -1 : 1  }
            })
        ])
        .then(([ total, data ]) => {
            //console.log(data)
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