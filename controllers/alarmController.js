const { validationResult } = require('express-validator');
const Alarm = require('../models/alarmModel');

exports.index = async (req, res, next) => {
    try {
        let { skip = 0, limit = 5, sort = 'desc' } = req.query;
        skip = parseInt(skip) || 0;
        limit = parseInt(limit) || 10;
        skip = skip < 0 ? 0 : skip;
        limit = Math.min(50, Math.max(1, limit));

        const [total, data] = await Promise.all([
            Alarm.countDocuments({}),
            Alarm.find({}, {}, { sort: { created: sort === 'desc' ? -1 : 1 } }).skip(skip).limit(limit)
        ]);

        res.json({
            status: "success",
            message: 'Alarms retrieved successfully',
            data: data,
            meta: { total, sort, skip, limit, has_more: total - (skip + limit) > 0 }
        });
    } catch (err) {
        next(err);
    }
};

exports.post = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ status: "error", errors: errors.array() });
    }

    try {
        const { espID, io, tStart, tStop } = req.body;
        const alarm = await Alarm.findOneAndUpdate(
            { espID, io },
            { tStart, tStop },
            { new: true, upsert: true, runValidators: true }
        );
        res.status(201).json({ message: 'Alarm created or updated!', data: alarm });
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
        const { espID, io, enabled } = req.body;
        const alarm = await Alarm.findOneAndUpdate(
            { espID, io },
            { enabled },
            { new: true, runValidators: true }
        );
        if (!alarm) {
            return res.status(404).json({ status: 'error', message: 'Alarm not found' });
        }
        res.json({ status: 'success', message: 'Alarm updated', data: alarm });
    } catch (err) {
        next(err);
    }
};

exports.getbyEsp = async (req, res, next) => {
    try {
        const alarms = await Alarm.find({ espID: req.params.espID });
        res.json({ status: 'success', data: alarms });
    } catch (err) {
        next(err);
    }
};

exports.getEspIO = async (req, res, next) => {
    try {
        const alarm = await Alarm.findOne({ espID: req.params.espID, io: req.params.io });
        if (!alarm) {
            return res.status(404).json({ status: 'error', message: 'Alarm not found' });
        }
        res.json({ status: 'success', data: alarm });
    } catch (err) {
        next(err);
    }
};
