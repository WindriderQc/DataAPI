const { validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const User = require('../models/userModel');
const { NotFoundError, BadRequest } = require('../utils/errors');

// index
exports.index = async (req, res, next) => {
    try {
        let { skip = 0, limit = 5, sort = 'desc' } = req.query;
        skip = parseInt(skip) || 0;
        limit = parseInt(limit) || 10;
        skip = skip < 0 ? 0 : skip;
        limit = Math.min(50, Math.max(1, limit));

        const [total, data] = await Promise.all([
            User.countDocuments({}),
            User.find({}, {}, { sort: { created: sort === 'desc' ? -1 : 1 } }).skip(skip).limit(limit)
        ]);

        res.json({
            status: "success",
            message: 'Users retrieved successfully',
            data: data,
            meta: { total, sort, skip, limit, has_more: total - (skip + limit) > 0 }
        });
    } catch (err) {
        next(err);
    }
};

// Helper function to pick allowed fields from an object
const pick = (obj, keys) => {
    return keys.reduce((acc, key) => {
        if (obj && Object.prototype.hasOwnProperty.call(obj, key)) {
            acc[key] = obj[key];
        }
        return acc;
    }, {});
};

// create
exports.new = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(new BadRequest(errors.array()));
    }

    try {
        const allowedFields = ['name', 'email', 'password', 'gender', 'phone', 'lon', 'lat'];
        const userData = pick(req.body, allowedFields);

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        userData.password = await bcrypt.hash(userData.password, salt);

        const user = new User(userData);
        await user.save();
        const userObject = user.toObject();
        delete userObject.password;
        res.status(201).json({ message: 'New user created!', data: userObject });
    } catch (err) {
        next(err);
    }
};

// login
exports.login = async (req, res, next) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            return next(new NotFoundError('User not found'));
        }

        const validPassword = await bcrypt.compare(req.body.password, user.password);
        if (!validPassword) {
            return next(new BadRequest('Invalid password'));
        }

        const userObject = user.toObject();
        delete userObject.password;
        res.json({ status: 'success', message: 'Login successful', data: userObject });
    } catch (err) {
        next(err);
    }
};

// view
exports.view = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.user_id);
        if (!user) {
            return next(new NotFoundError('User not found'));
        }
        res.json({ status: 'success', message: 'User details loading..', data: user });
    } catch (err) {
        next(err);
    }
};

// from Email
exports.fromEmail = async (req, res, next) => {
    try {
        const user = await User.findOne({ email: req.params.email });
        if (!user) {
            return next(new NotFoundError('User not found'));
        }
        res.json({ status: 'success', message: 'User details loading..', data: user });
    } catch (err) {
        next(err);
    }
};

// update
exports.update = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(new BadRequest(errors.array()));
    }

    try {
        const user = await User.findById(req.params.user_id);
        if (!user) {
            return next(new NotFoundError('User not found'));
        }

        const allowedUpdates = ['name', 'gender', 'email', 'phone', 'lon', 'lat', 'lastConnectDate'];
        const updates = pick(req.body, allowedUpdates);

        // Special handling for numeric types
        if (updates.lat) updates.lat = parseFloat(updates.lat);
        if (updates.lon) updates.lon = parseFloat(updates.lon);

        Object.assign(user, updates);

        await user.save();
        res.json({ status: 'success', message: 'User Info updated', data: user });
    } catch (err) {
        next(err);
    }
};

// delete
exports.delete = async (req, res, next) => {
    try {
        // Note: .remove() is deprecated. Using deleteOne() instead.
        const result = await User.deleteOne({ _id: req.params.user_id });
        if (result.deletedCount === 0) {
            return next(new NotFoundError('User not found'));
        }
        res.json({ status: 'success', message: 'User deleted' });
    } catch (err) {
        next(err);
    }
};