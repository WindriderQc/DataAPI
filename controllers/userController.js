const User = require('../models/userModel')


// index 
exports.index = (req, res) =>
{
   // User.get( (err, users) =>{ errorCheck(err, res, { status: "success", message: "Users retrieved successfully", data: users })     })
   console.log("Requesting users:", req.query)
   let { skip = 0, limit = 5, sort = 'desc' }  = req.query  //  http://192.168.0.33:3003/users?skip=0&limit=25&sort=desc
   skip = parseInt(skip) || 0
   limit = parseInt(limit) || 10

   skip = skip < 0 ? 0 : skip;
   limit = Math.min(50, Math.max(1, limit))


   Promise.all([
        User.countDocuments({}),
        User.find({}, {}, { sort: {  created: sort === 'desc' ? -1 : 1  } })
   ])
   .then(([ total, data ]) => {
       res.json({  status: "success", message: 'Users retrieved successfully', 
                   data: data, 
                   meta: { total, sort, skip, limit, has_more: total - (skip + limit) > 0 }  
               })
   })  
   .catch(err => {  res.json({ status:'error', message: err, data: null}) })  
}


// create  
exports.new = (req, res) =>
{
    let user = new User();
    user.name = req.body.name ? req.body.name : user.name
    user.email = req.body.email
    user.password = req.body.password
    user.gender = req.body.gender ? req.body.gender : user.gender
    user.email = req.body.email ? req.body.email : user.email
    user.phone = req.body.phone ? req.body.phone : user.phone
    user.lon = req.body.lon ? req.body.lon : user.lon
    user.lat = req.body.lat ? req.body.lat : user.lat
    user.lastConnectDate = req.body.lastConnectDate ? req.body.lastConnectDate : user.lastConnectDate
    
    user.save( (err) => { errorCheck(err, res, { message: 'New contact created!', data: user }) })
}


// view  
exports.view = (req, res) =>
{
    User.findById(req.params.user_id, (err, user) =>{ errorCheck(err, res, { status: 'success', message: 'User details loading..', data: user }) })
}

// from Email  
exports.fromEmail = (req, res) =>
{
    User.find({email:req.params.email}, (err, user) =>{ errorCheck(err, res, { status: 'success', message: 'User details loading..', data: user }) })
}


// update  
exports.update = (req, res) =>
{
    try{
        console.log('update request: ', )
        User.findById(req.body._id, (err, user) =>{
            if (err) res.json({ status: 'error', message: err }) 
            console.log("user: ", user)
            user.name = req.body.name ? req.body.name : user.name
            user.gender = req.body.gender ? req.body.gender : user.gender
            user.email = req.body.email ? req.body.email : user.email
            user.phone = req.body.phone ? req.body.phone : user.phone
            
            user.lon = req.body.lon ? req.body.lon : user.lon
            user.lat = req.body.lat ? req.body.lat : user.lat
            user.lastConnectDate = req.body.lastConnectDate ? req.body.lastConnectDate : user.lastConnectDate
            
            user.save((err) =>{  errorCheck(err, res, { status: 'success', message: 'User Info updated', data: user  }) })
        })

    } catch (err) { console.log ( 'error updating user by id: ', err)}
}


// delete 
exports.delete =  (req, res) =>
{
    User.remove({  _id: req.params.user_id }, (err, contact) =>{  errorCheck(err, res, { status: 'success',  message: 'User deleted' }) })
}


// helper method
errorCheck = (err, res, successMsg) =>
{
    if (err) res.json({ status: 'error', message: err }) 
    else     res.json(successMsg)    
}