const Iss = require('../models/issModel');
const Quake = require('../models/quakeModel');
const liveData = require('../scripts/liveData');
const { NotFoundError } = require('../utils/errors');

exports.quakes = async (req, res, next) => {
    try {
        const [count, quakes] = await Promise.all([
            Quake.countDocuments(),
            Quake.find({})
        ]);
        res.json({ status: "success", message: 'Quakes retrieved successfully', meta: { count }, data: quakes });
    } catch (err) {
        next(err);
    }
};

exports.iss = async (req, res, next) => {
    try {
        const [total, data] = await Promise.all([
            Iss.countDocuments({}),
            Iss.find({}, {}, { sort: { created: -1 } })
        ]);
        res.json({ status: "success", message: 'Iss locations retrieved successfully', meta: { total }, data: data });
    } catch (err) {
        next(err);
    }
};

exports.deleteAllIss = async (req, res, next) => {
    try {
        const ack = await Iss.deleteMany({});
        res.json({ status: "success", message: 'All Iss deleted', data: ack });
    } catch (err) {
        next(err);
    }
};

exports.deleteAllQuakes = async (req, res, next) => {
    try {
        const ack = await Quake.deleteMany({});
        res.json({ status: "success", message: 'All Quakes deleted', data: ack });
    } catch (err) {
        next(err);
    }
};
