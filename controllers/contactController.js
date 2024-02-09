// contactController.js
// Import contact model
Contact = require('../models/contactModel');

// Handle index actions
exports.index = function (req, res) {
    /*Contact.get(function (err, contacts) {
        if (err) { res.json({  status: "error",  message: err,       });        }
        res.json({     status: "success",    message: "Contacts retrieved successfully", data: contacts  });
    }); */

    console.log("Requesting devices:", req.query)
    let { skip = 0, limit = 5, sort = 'desc' }  = req.query  //  http://192.168.0.33:3003/Contact?skip=0&limit=25&sort=desc
    skip = parseInt(skip) || 0
    limit = parseInt(limit) || 10

    skip = skip < 0 ? 0 : skip;
    limit = Math.min(50, Math.max(1, limit))


    Promise.all([
        Contact.countDocuments({}),
        Contact.find({}, {}, { sort: {  created: sort === 'desc' ? -1 : 1  }      })
    ])
    .then(([ total, data ]) => {
        res.json({  status: "success", message: 'Contacts retrieved successfully', 
                    data: data, 
                    meta: { total, sort, skip, limit, has_more: total - (skip + limit) > 0 }  
                })
    })  
    .catch(err => {  res.json({ status:'error', message: err, data: null}) }) 

};

// Handle create contact actions
exports.new = function (req, res) {
    var contact = new Contact();
    contact.name = req.body.name ? req.body.name : contact.name;
    contact.gender = req.body.gender;
    contact.email = req.body.email;
    contact.phone = req.body.phone;
// save the contact and check for errors
    contact.save(function (err) {
        // Check for validation error
        if (err)
            res.json(err);
        else
            res.json({
                message: 'New contact created!',
                data: contact
            });
    });
};

// Handle view contact info
exports.view = function (req, res) {
    Contact.findById(req.params.contact_id, function (err, contact) {
        if (err)
            res.send(err);
        res.json({
            message: 'Contact details loading..',
            data: contact
        });
    });
};

// Handle update contact info
exports.update = function (req, res) {
    Contact.findById(req.params.contact_id, function (err, contact) {
        if (err)
            res.send(err);
        contact.name = req.body.name ? req.body.name : contact.name;
        contact.gender = req.body.gender;
        contact.email = req.body.email;
        contact.phone = req.body.phone;
// save the contact and check for errors
        contact.save(function (err) {
            if (err)
                res.json(err);
            res.json({
                message: 'Contact Info updated',
                data: contact
            });
        });
    });
};

// Handle delete contact
exports.delete = function (req, res) {
    Contact.remove({
        _id: req.params.contact_id
    }, function (err, contact) {
        if (err)
            res.send(err);
        res.json({
            status: "success",
            message: 'Contact deleted'
        });
    });
};