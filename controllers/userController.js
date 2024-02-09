const User = require('../models/userModel')


// index 
exports.index = (req, res) =>{

   // User.get( (err, users) =>{ errorCheck(err, res, { status: "success", message: "Users retrieved successfully", data: users })     })

   console.log("Requesting users:", req.query)
   let { skip = 0, limit = 5, sort = 'desc' }  = req.query  //  http://192.168.0.33:3003/users?skip=0&limit=25&sort=desc
   skip = parseInt(skip) || 0
   limit = parseInt(limit) || 10

   skip = skip < 0 ? 0 : skip;
   limit = Math.min(50, Math.max(1, limit))


   Promise.all([
        User.countDocuments({}),
        User.find({}, {}, { sort: {  created: sort === 'desc' ? -1 : 1  }      })
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
exports.new = (req, res) =>{

    var user = new User();
    user.name = req.body.name ? req.body.name : user.name
    user.email = req.body.email
    
    user.save( (err) => { errorCheck(err, res, { message: 'New contact created!', data: user })     })
}


// view  
exports.view = (req, res) =>{

    User.findById(req.params.user_id, (err, user) =>{ errorCheck(err, res, { message: 'User details loading..', data: user })   })
}


// update  
exports.update = (req, res) =>{

    User.findById(req.params.user_id, (err, user) =>{
       
        user.name = req.body.name ? req.body.name : user.name
        user.gender = req.body.gender
        user.email = req.body.email
        user.phone = req.body.phone
        if (err) res.send(err)
        user.save((err) =>{  errorCheck(err, res, { message: 'User Info updated', data: user  })   })
    })
}


// delete 
exports.delete =  (req, res) =>{

    User.remove({  _id: req.params.user_id }, (err, contact) =>{  errorCheck(err, res, { status: "success",  message: 'User deleted' })     })
}


// helper method
errorCheck = (err, res, successMsg) =>{
    if (err) res.json({ status: "error", message: err }) 
    else     res.json(successMsg)    
}