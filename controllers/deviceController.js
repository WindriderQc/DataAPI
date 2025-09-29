const { validationResult } = require('express-validator');
const Device = require('../models/deviceModel');
const { NotFoundError, BadRequest } = require('../utils/errors');

const APIFeatures = require('../utils/apiFeatures');

exports.index = async (req, res, next) => {
    try {
        const initialQuery = Device.find({});
        const features = new APIFeatures(initialQuery, req.query).paginate().sort();
        const result = await APIFeatures.execute(initialQuery, features);

        res.json({
            status: "success",
            message: 'Devices retrieved successfully',
            ...result
        });
    } catch (err) {
        next(err);
    }
};

exports.readOne = async (req, res, next) => {
    try {
        const device = await Device.findOne({ id: req.params.id });
        if (!device) {
            return next(new NotFoundError('Device not found'));
        }
        res.json({ status: "success", message: 'Device retrieved successfully', data: device });
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
        const query = { id: req.body.id };
        const update = { type: req.body.type, lastBoot: req.body.lastBoot, connected: req.body.connected, config: req.body.config, payload: req.body.payload };
        const doc = await Device.findOneAndUpdate(query, update, { upsert: true, new: true, setDefaultsOnInsert: true });
        res.status(200).json({ status: "success", message: 'Device registration Info updated/created', data: doc });
    } catch (err) {
        next(err);
    }
};

exports.deleteOne = async (req, res, next) => {
    try {
        const result = await Device.deleteOne({ id: req.params.id });
        if (result.deletedCount === 0) {
            return next(new NotFoundError('Device not found'));
        }
        res.json({ status: "success", message: 'Device ' + req.params.id + ' deleted' });
    } catch (err) {
        next(err);
    }
};

exports.deleteAll = async (req, res, next) => {
    try {
        const ack = await Device.deleteMany({});
        res.json({ status: "success", message: 'All registered Devices deleted', data: ack });
    } catch (err) {
        next(err);
    }
};
