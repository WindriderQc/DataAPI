const { validationResult } = require('express-validator');
const Heartbeat = require('../models/heartbeatModel');
const { NotFoundError, BadRequest } = require('../utils/errors');

exports.index = async (req, res, next) => {
    try {
        let { skip = 0, limit = 5, sort = 'desc' } = req.query;
        skip = parseInt(skip) || 0;
        limit = parseInt(limit) || 10;
        skip = skip < 0 ? 0 : skip;
        limit = Math.min(50, Math.max(1, limit));

        const [total, data] = await Promise.all([
            Heartbeat.countDocuments({}),
            Heartbeat.find({}, {}, { sort: { created: sort === 'desc' ? -1 : 1 } }).skip(skip).limit(limit)
        ]);

        res.json({
            status: "success",
            message: 'Heartbeats retrieved successfully',
            data: data,
            meta: { total, sort, skip, limit, has_more: total - (skip + limit) > 0 }
        });
    } catch (err) {
        next(err);
    }
};

exports.byId = async (req, res, next) => {
    try {
        const post = await Heartbeat.findById(req.params.post_id);
        if (!post) {
            return next(new NotFoundError('Post not found'));
        }
        res.json({ status: "success", message: 'Heartbeat retrieved successfully', data: post });
    } catch (err) {
        next(err);
    }
};

exports.new = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(new BadRequest(errors.array()));
    }

    try {
        const post = new Heartbeat(req.body);
        await post.save();
        res.status(201).json({ status: "success", message: 'Heartbeat logged successfully', data: post });
    } catch (err) {
        next(err);
    }
};

exports.delete = async (req, res, next) => {
    try {
        const result = await Heartbeat.deleteOne({ _id: req.params.post_id });
        if (result.deletedCount === 0) {
            return next(new NotFoundError('Post not found'));
        }
        res.json({ status: "success", message: 'Post deleted' });
    } catch (err) {
        next(err);
    }
};

exports.deleteAll = async (req, res, next) => {
    try {
        const ack = await Heartbeat.deleteMany({});
        res.json({ status: "success", message: 'All Heartbeats deleted', data: ack });
    } catch (err) {
        next(err);
    }
};

exports.sendersDistinct = async (req, res, next) => {
    try {
        const devices = await Heartbeat.distinct('sender');
        res.json({ status: "success", message: 'Latest heartbeaters retrieved', data: devices });
    } catch (err) {
        next(err);
    }
};

exports.senderLatest = async (req, res, next) => {
    try {
        const latest = await Heartbeat.find({ "sender": req.params.esp }).sort({ _id: -1 }).limit(1);
        res.json({ status: "success", message: 'Latest heartbeat retreived', data: latest });
    } catch (err) {
        next(err);
    }
};

exports.senderOldest = async (req, res, next) => {
    try {
        const oldest = await Heartbeat.find({ "sender": req.params.esp }).sort({ _id: 1 }).limit(1);
        res.json({ status: "success", message: 'Oldest heartbeat retreived', data: oldest });
    } catch (err) {
        next(err);
    }
};

exports.data = async (req, res, next) => {
    try {
        const options = req.params.options.split(',');
        const ratio = Number(options[0]);
        const espID = options[1];
        const startDate = options[2];
        const opt = { ratio, espID, startDate };

        const data = await Heartbeat.find({ sender: espID, time: { $gt: startDate } }).sort({ time: 1 }).limit(50000);

        let ret = [];
        for (let i = 0, len = data.length; i < len; i++) {
            if (i % ratio === 0) {
                ret.push(data[i]);
            }
        }

        res.json({ status: "success", message: `Data with options ${JSON.stringify(opt)} retreived`, data: ret });
    } catch (err) {
        next(err);
    }
};
