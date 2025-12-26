// controllers/userController.js
const { validationResult } = require('express-validator');
const { BadRequest, NotFoundError, ConflictError } = require('../utils/errors');

// GET /users
exports.index = async (req, res, next) => {
    const { User } = req.app.locals.models;
    try {
        const users = await User.find();
        res.json({
            status: 'success',
            message: 'Users retrieved successfully',
            data: users
        });
    } catch (err) {
        next(err);
    }
};

// POST /users
exports.new = async (req, res, next) => {
    const { User } = req.app.locals.models;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(new BadRequest(errors.array()));
    }

    try {
        const { name, email, password, lat, lon } = req.body;
        const user = new User({ name, email, password, lat, lon });
        await user.save();

        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(201).json({
            status: 'success',
            message: 'New user created!',
            data: userResponse
        });
    } catch (err) {
        if (err.code === 11000) {
            return next(new ConflictError('Email already in use.'));
        }
        next(err);
    }
};

// POST /users/login
exports.login = async (req, res, next) => {
    const { User } = req.app.locals.models;
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return next(new BadRequest('Invalid email or password'));
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return next(new BadRequest('Invalid email or password'));
        }

        user.lastConnectDate = new Date();
        await user.save();

        const userResponse = user.toObject();
        delete userResponse.password;

        res.json({
            status: 'success',
            message: 'Login successful',
            data: userResponse
        });
    } catch (err) {
        next(err);
    }
};

// GET /users/fromEmail/:email
exports.fromEmail = async (req, res, next) => {
    const { User } = req.app.locals.models;
    try {
        const user = await User.findOne({ email: req.params.email });
        if (!user) return next(new NotFoundError('User not found'));
        res.json({
            status: 'success',
            message: 'User retrieved successfully',
            data: user
        });
    } catch (err) {
        next(err);
    }
};

// GET /users/:id
exports.view = async (req, res, next) => {
    const { User } = req.app.locals.models;
    try {
        const user = await User.findById(req.params.id);
        if (!user) return next(new NotFoundError('User not found'));
        res.json({
            status: 'success',
            message: 'User retrieved successfully',
            data: user
        });
    } catch (err) {
        next(err);
    }
};

// PATCH/PUT /users/:id
exports.update = async (req, res, next) => {
    const { User } = req.app.locals.models;
    try {
        const updateData = { ...req.body };

        const user = await User.findById(req.params.id);
        if (!user) return next(new NotFoundError('User not found'));

        // Handle password update with confirmation
        if (updateData.password) {
            // Validate password length
            if (updateData.password.length < 6) {
                return next(new BadRequest('Password must be at least 6 characters long.'));
            }

            // Validate password confirmation
            if (updateData.password !== updateData.confirmPassword) {
                return next(new BadRequest('Passwords do not match.'));
            }

            user.password = updateData.password;
            // Remove confirmPassword as it's not a model field
        }

        // Remove password fields from updateData before applying other updates
        delete updateData.password;
        delete updateData.confirmPassword;

        // Apply other updates
        Object.assign(user, updateData);

        await user.save();

        const userResponse = user.toObject();
        delete userResponse.password;

        res.json({
            status: 'success',
            message: 'User updated successfully',
            data: userResponse
        });
    } catch (err) {
        next(err);
    }
};

// DELETE /users/:id
exports.delete = async (req, res, next) => {
    const { User } = req.app.locals.models;
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return next(new NotFoundError('User not found'));
        res.json({
            status: 'success',
            message: 'User deleted'
        });
    } catch (err) {
        next(err);
    }
};

// Model view controller for rendering the users page.
exports.renderUsersPage = async (req, res, next) => {
    const { User } = req.app.locals.models;
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
        next(err);
    }
};