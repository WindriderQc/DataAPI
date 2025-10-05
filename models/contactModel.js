// contactModel.js
const mongoose = require('mongoose');
// Setup schema
const contactSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    gender: String,
    phone: String,
    create_date: {
        type: Date,
        default: Date.now
    }
});


const config = require('../config/config');

// Use the mainDb name from the centralized configuration for core models
const mainDbConnection = mongoose.connection.useDb(config.db.mainDb, { useCache: true });

// Export Contact model, compiled on the correct database connection
const Contact = mainDbConnection.model('contact', contactSchema);
module.exports = Contact;

// The `.get` method is a custom static-like method. Re-attach it to the exported model.
module.exports.get = (callback, limit) => Contact.find(callback).limit(limit);