const { validationResult } = require('express-validator');
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

// create
exports.new = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(new BadRequest(errors.array()));
    }

    try {
        const user = new User(req.body);
        await user.save();
        const userObject = user.toObject();
        delete userObject.password;
        res.status(201).json({ message: 'New user created!', data: userObject });
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
        const user = await User.findById(req.body._id);
        if (!user) {
            return next(new NotFoundError('User not found'));
        }

        // Use Object.assign for cleaner updates
        const allowedUpdates = ['name', 'gender', 'email', 'phone', 'lon', 'lat', 'lastConnectDate'];
        Object.keys(req.body).forEach(key => {
            if (allowedUpdates.includes(key)) {
                if (key === 'lat' || key === 'lon') {
                    user[key] = parseFloat(req.body[key]);
                } else {
                    user[key] = req.body[key];
                }
            }
        });

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