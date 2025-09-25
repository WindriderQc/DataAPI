// models/usermodel.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, max: 1024, min: 6 },
    lat: { type: Number, required: false },
    lon: { type: Number, required: false },
    creationDate: { type: Date, default: Date.now },
    lastConnectDate: { type: Date, default: Date.now }
});

// Pre-save hook: hash password if changed
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

// Compare password for login
userSchema.methods.comparePassword = function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// DB selection
const dbName = process.env.NODE_ENV === 'production' ? 'datas' : 'devdatas';
const myDB = mongoose.connection.useDb(dbName);

const User = myDB.model('User', userSchema);
module.exports = User;
