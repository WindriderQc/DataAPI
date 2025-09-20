const { validationResult } = require('express-validator');
const Device = require('../models/deviceModel');

exports.index = async (req, res, next) => {
    try {
        let { skip = 0, limit = 5, sort = 'desc' } = req.query;
        skip = parseInt(skip) || 0;
        limit = parseInt(limit) || 10;
        skip = skip < 0 ? 0 : skip;
        limit = Math.min(50, Math.max(1, limit));

        const [total, data] = await Promise.all([
            Device.countDocuments({}),
            Device.find({}, {}, { sort: { created: sort === 'desc' ? -1 : 1 } }).skip(skip).limit(limit)
        ]);

        res.json({
            status: "success",
            message: 'Devices retrieved successfully',
            data: data,
            meta: { total, sort, skip, limit, has_more: total - (skip + limit) > 0 }
        });
    } catch (err) {
        next(err);
    }
};

exports.readOne = async (req, res, next) => {
    try {
        const device = await Device.findOne({ id: req.params.id });
        if (!device) {
            return res.status(404).json({ status: 'error', message: 'Device not found' });
        }
        res.json({ status: "success", message: 'Device retrieved successfully', data: device });
    } catch (err) {
        next(err);
    }
};

exports.update = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ status: "error", errors: errors.array() });
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
            return res.status(404).json({ status: 'error', message: 'Device not found' });
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
