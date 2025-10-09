const { validationResult } = require('express-validator');
const Profiles = require('../models/profileModel');
const { NotFoundError, BadRequest } = require('../utils/errors');
const { ObjectId } = require('mongodb');

// Helper: try to create an ObjectId in a tolerant way. Some driver/runtime
// shapes expose ObjectId as a class requiring `new`, others as a function.
// Attempt `new ObjectId(value)` first, fall back to `ObjectId(value)` if needed.
function toObjectId(value) {
    if (!value) return null;
    try {
        return new ObjectId(value);
    } catch (e) {
        try {
            // Some environments expose ObjectId as a factory function
            return ObjectId(value);
        } catch (e2) {
            // rethrow original for clearer debug
            throw e;
        }
    }
}

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

// New: list profiles (for API)
exports.listProfiles = async (req, res, next) => {
    try {
        const profiles = await Profiles.find({});
        res.json({ status: 'success', message: 'Profiles listed', data: profiles });
    } catch (err) {
        next(err);
    }
};

// New: create profile
exports.createProfile = async (req, res, next) => {
    try {
        const { profileName, isAdmin, config } = req.body;
        if (!profileName) return next(new BadRequest('profileName required'));
        const doc = new Profiles({ profileName, isAdmin: !!isAdmin, config: config || [] });
        await doc.save();
        res.status(201).json({ status: 'success', message: 'Profile created', data: doc });
    } catch (err) {
        next(err);
    }
};

// New: assign profile to user
exports.assignProfileToUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { profileId } = req.body;
        if (!profileId) return next(new BadRequest('profileId required'));
    const db = req.app.locals.dbs.mainDb;
    const prof = await db.collection('profiles').findOne({ _id: toObjectId(profileId) });
        if (!prof) return next(new NotFoundError('Profile not found'));
    const resu = await db.collection('users').findOneAndUpdate({ _id: toObjectId(id) }, { $set: { profileId: profileId } }, { returnDocument: 'after' });
        if (!resu.value) return next(new NotFoundError('User not found'));
        res.json({ status: 'success', message: 'Profile assigned', data: resu.value });
    } catch (err) {
        next(err);
    }
};
