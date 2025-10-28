const { validationResult } = require('express-validator');
const Profiles = require('../models/profileModel');
const { NotFoundError, BadRequest } = require('../utils/errors');
const { ObjectId } = require('mongodb');

function normalizeObjectId(value, fieldName) {
    if (!value) {
        throw new BadRequest([{ msg: `${fieldName} is required`, param: fieldName }]);
    }

    try {
        return new ObjectId(value);
    } catch (err) {
        throw new BadRequest([{ msg: `${fieldName} must be a valid ObjectId`, param: fieldName }]);
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

        const db = req.app.locals.dbs.mainDb;
        const normalizedProfileId = normalizeObjectId(profileId, 'profileId');
        const normalizedUserId = normalizeObjectId(id, 'id');

        const prof = await db.collection('profiles').findOne({ _id: normalizedProfileId });
        if (!prof) return next(new NotFoundError('Profile not found'));

        const updateResult = await db.collection('users').updateOne(
            { _id: normalizedUserId },
            { $set: { profileId: normalizedProfileId } }
        );

        if (!updateResult.matchedCount) {
            return next(new NotFoundError('User not found'));
        }

        const updatedDoc = await db.collection('users').findOne({ _id: normalizedUserId });

        const updatedUser = {
            ...updatedDoc,
            _id: updatedDoc && updatedDoc._id ? updatedDoc._id.toString() : updatedDoc && updatedDoc._id,
            profileId:
                updatedDoc && updatedDoc.profileId ? updatedDoc.profileId.toString() : updatedDoc && updatedDoc.profileId
        };

        res.json({ status: 'success', message: 'Profile assigned', data: updatedUser });
    } catch (err) {
        next(err);
    }
};
