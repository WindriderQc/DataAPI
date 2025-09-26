// controllers/userController.js
const User = require('../models/userModel');
const { validationResult } = require('express-validator');

// GET /users
exports.index = async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);  // Keep API-style JSON
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /users
exports.new = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { name, email, password, lat, lon } = req.body;
        const user = new User({ name, email, password, lat, lon });
        await user.save();

        // Exclude password from the returned object
        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(201).json({
            message: 'New user created!',
            data: userResponse
        });
    } catch (err) {
        // Handle potential duplicate email errors or other DB issues
        if (err.code === 11000) {
            return res.status(409).json({ message: 'Email already in use.' });
        }
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
};

// POST /users/login
exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        user.lastConnectDate = new Date();
        await user.save();

        const userResponse = user.toObject();
        delete userResponse.password;

        res.json({
            message: 'Login successful',
            data: userResponse
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /users/fromEmail/:email
exports.fromEmail = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.params.email });
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /users/:id
exports.view = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PATCH/PUT /users/:id
exports.update = async (req, res) => {
    try {
        const updateData = req.body;
        if (updateData.password) delete updateData.password; // avoid direct password change
        const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// DELETE /users/:id
exports.delete = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};



// Model view controller for rendering the users page.
exports.renderUsersPage = async (req, res) => {
    try {
        const users = await User.find();
       res.render('users', {
            title: 'Users',
            users: users.map(u => ({
                _id: u._id,
                name: u.name,
                email: u.email,
                lat: u.lat,
                lon: u.lon,
                creationDate: u.creationDate,
                lastConnectDate: u.lastConnectDate
            }))
        });
    } catch (err) {
        res.status(500).send('Server Error');
    }
};
