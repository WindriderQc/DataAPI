const Profiles = require('../models/profileModel');

// Gets back all the devices
async function index(req, res) {
    try {
        const profiles = await Profiles.find({});
        res.json({ status: "success", message: 'All Profiles retrieved successfully', data: profiles });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
}

// Get a specific profile by ID
async function readOne(req, res) {
    try {
        const profile = await Profiles.findOne({ id: req.params.id });
        res.json({ status: "success", message: 'ProfilesConfig retrieved successfully from ID', data: profile });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
}

// Get a specific profile by profileName
async function getFromProfileName(req, res) {
    try {
        const profile = await Profiles.findOne({ profileName: req.params.profileName });
        res.json({ status: "success", message: 'Profile Config retrieved successfully from Name', data: profile });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
}

// Update a specific profile by ID
async function update(req, res) {
    const query = { id: req.body.id };
    const update = { profileName: req.body.profileName, config: req.body.config };
    try {
        const doc = await Profiles.findOneAndUpdate(query, update, { upsert: true, new: true, setDefaultsOnInsert: true });
        res.status(200).json({ status: "success", message: 'ProfilesConfig updated/created', data: doc });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
}

// Delete a specific profile by ID
async function deleteOne(req, res) {
    try {
        const ack = await Profiles.deleteOne({ id: req.params.id });
        res.json({ status: "success", message: `ProfilesConfig ${req.params.id} deleted`, data: ack });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
}

// Delete all profiles
async function deleteAll(req, res) {
    try {
        const ack = await Profiles.deleteMany({});
        res.json({ status: "success", message: 'All ProfilesConfig deleted', data: ack });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
}

module.exports = { index, readOne, getFromProfileName, update, deleteOne, deleteAll };
