// controllers/userController.js
const User = require('../models/userModel');

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
    try {
        const { name, email, password, lat, lon } = req.body;
        const user = new User({ name, email, password, lat, lon });
        await user.save();
        res.status(201).json(user);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// POST /users/login
exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid email or password' });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

        // Update lastConnectDate
        user.lastConnectDate = new Date();
        await user.save();

        res.json({ message: 'Login successful', userId: user._id });
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

// GET /users/:user_id
exports.view = async (req, res) => {
    try {
        const user = await User.findById(req.params.user_id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PATCH/PUT /users/:user_id
exports.update = async (req, res) => {
    try {
        const updateData = req.body;
        if (updateData.password) delete updateData.password; // avoid direct password change
        const user = await User.findByIdAndUpdate(req.params.user_id, updateData, { new: true });
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// DELETE /users/:user_id
exports.delete = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.user_id);
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
