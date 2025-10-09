'use strict';

const { normalizeCountryData } = require('../utils/location-normalizer');

const getLogs = (source) => async (req, res, next) => {
    try {
        let { skip = 0, sort = 'desc' } = req.query;
        skip = parseInt(skip) || 0;
        skip = skip < 0 ? 0 : skip;

        const db = req.app.locals.dbs.mainDb;
        if (!db) {
            return res.status(500).json({ error: 'Main database not found.' });
        }
        const logsdb = db.collection(source);

        const [total, logs] = await Promise.all([
            logsdb.countDocuments(),
            logsdb.find({}).sort({ created: sort === 'desc' ? -1 : 1 }).skip(skip).limit(1000).toArray()
        ]);

        const enrichedLogs = await Promise.all(logs.map(l => normalizeCountryData(l, db, source, l._id)));

        try {
            const withCountry = enrichedLogs.filter(l => l && l.CountryName && String(l.CountryName).trim().length > 0).length;
            console.log(`[logController] getLogs for ${source}: total=${total}, returned=${enrichedLogs.length}, withCountry=${withCountry}`);
        } catch (e) {
            console.log(`[logController] getLogs: error counting enriched CountryName`, e.message);
        }

        res.json({
            logs: enrichedLogs,
            meta: { total, skip, source, db: db.databaseName, has_more: logs.length > 0 && (skip + logs.length < total) }
        });
    } catch (error) {
        next(error);
    }
};

const createLog = (source) => async (req, res, next) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(422).json({
                message: 'Hey! Invalid log....'
            });
        }

        const log = req.body;
        log.created = new Date();

        const db = req.app.locals.dbs.mainDb;
        if (!db) {
            return res.status(500).json({ error: 'Main database not found.' });
        }

        const logsdb = db.collection(source);
        const createdLog = await logsdb.insertOne(log);

        console.log(`Log document for ${source} was inserted with the _id: ${createdLog.insertedId}`);
        res.status(201).json(createdLog);
    } catch (error) {
        next(error);
    }
};

const getCountryCounts = async (req, res, next) => {
    try {
        const { source = 'userLogs' } = req.query;

        const db = req.app.locals.dbs.mainDb;
        if (!db) {
            return res.status(500).json({ error: 'Main database not found.' });
        }
        const logsdb = db.collection(source);

        const pipeline = [
            { $match: { CountryName: { $exists: true, $type: 'string', $regex: /\S/ } } },
            { $group: { _id: '$CountryName', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ];

        const results = await logsdb.aggregate(pipeline).toArray();
        res.json({ status: 'success', data: results });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getUserLogs: getLogs('userLogs'),
    createUserLog: createLog('userLogs'),
    getServerLogs: getLogs('serverLogs'),
    createServerLog: createLog('serverLogs'),
    getCountryCounts,
};

// Dynamic handler for v2-style endpoint used by the dashboard client.
// It delegates to the existing getLogs factory using the `source` query parameter.
module.exports.getLogsForSource = (req, res, next) => {
    const source = (req.query && req.query.source) ? req.query.source : 'userLogs';
    return getLogs(source)(req, res, next);
};