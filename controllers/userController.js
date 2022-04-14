const User = require('../models/userModel')


// index 
exports.index = (req, res) =>{

    User.get( (err, users) =>{ errorCheck(err, res, { status: "success", message: "Users retrieved successfully", data: users })     })
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