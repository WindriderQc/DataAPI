const { validationResult } = require('express-validator');
const Profiles = require('../models/profileModel');
const { NotFoundError, BadRequest } = require('../utils/errors');

exports.index = async (req, res, next) => {
    try {
        const profiles = await Profiles.find({});
        res.json({ status: "success", message: 'All Profiles retrieved successfully', data: profiles });
    } catch (err) {
        next(err);
    }
};

exports.getFromProfileName = async (req, res, next) => {
    try {
        const profile = await Profiles.findOne({ profileName: req.params.profileName });
        if (!profile) {
            return next(new NotFoundError('Profile not found'));
        }
        res.json({ status: "success", message: 'Profile Config retrieved successfully from Name', data: profile });
    } catch (err) {
        next(err);
    }
};

exports.update = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(new BadRequest(errors.array()));
    }

    try {
        const query = { profileName: req.body.profileName };
        const update = { config: req.body.config, content: req.body.content };
        const doc = await Profiles.findOneAndUpdate(query, update, { upsert: true, new: true, setDefaultsOnInsert: true });
        res.status(200).json({ status: "success", message: 'ProfilesConfig updated/created', data: doc });
    } catch (err) {
        next(err);
    }
};

exports.deleteOne = async (req, res, next) => {
    try {
        const result = await Profiles.deleteOne({ profileName: req.params.profileName });
        if (result.deletedCount === 0) {
            return next(new NotFoundError('Profile not found'));
        }
        res.json({ status: "success", message: `ProfilesConfig ${req.params.profileName} deleted` });
    } catch (err) {
        next(err);
    }
};

exports.deleteAll = async (req, res, next) => {
    try {
        const ack = await Profiles.deleteMany({});
        res.json({ status: "success", message: 'All ProfilesConfig deleted', data: ack });
    } catch (err) {
        next(err);
    }
};
