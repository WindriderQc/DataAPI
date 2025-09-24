const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true // It's good practice to have unique emails
    },
    password: {
        type: String,
        required: true,
        max: 1024,
        min: 6
    },
    lat: {
        type: Number,
        required: false
    },
    lon: {
        type: Number,
        required: false
    },
    creationDate: {
        type: Date,
        required: false,
        default: Date.now
    },
    lastConnectDate: {
        type: Date,
        required: false,
        default: Date.now
    }
});

// Pre-save hook to hash password
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

// Method to compare password for login
userSchema.methods.comparePassword = function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};


const dbName = process.env.NODE_ENV === 'production' ? 'datas' : 'devdatas';
const myDB = mongoose.connection.useDb(dbName);

let User = module.exports = myDB.model('user', userSchema);
module.exports.get = (callback, limit) => User.find(callback).limit(limit);