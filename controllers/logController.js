'use strict';

/**
 * @fileoverview Controller for handling user and system logs.
 */
const { normalizeCountryData } = require('../utils/location-normalizer');


const getUserLogs = async (req, res, next) => {
    try {
        let { skip = 0, sort = 'desc', source = 'userLogs', db = 'SBQC' } = req.query;
        skip = parseInt(skip) || 0;
        skip = skip < 0 ? 0 : skip;

        const dbs = req.app.locals.dbs;
        if (!dbs || !dbs[db]) {
            return res.status(500).json({ error: `Database '${db}' not found.` });
        }
        const logsdb = dbs[db].collection(source);

        const [total, logs] = await Promise.all([
            logsdb.countDocuments(),
            logsdb.find({}).sort({ created: sort === 'desc' ? -1 : 1 }).skip(skip).limit(1000).toArray()
        ]);

        const enrichedLogs = await Promise.all(logs.map(normalizeCountryData));

        // Debugging info: how many returned logs have a CountryName after enrichment
        try {
            const withCountry = enrichedLogs.filter(l => l && l.CountryName && String(l.CountryName).trim().length > 0).length;
            console.log(`[logController] getUserLogs: total=${total}, returned=${enrichedLogs.length}, withCountry=${withCountry}`);
        } catch (e) {
            console.log('[logController] getUserLogs: error counting enriched CountryName', e.message);
        }

        res.json({
            logs: enrichedLogs,
            meta: { total, skip, source, db, has_more: logs.length > 0 && (skip + logs.length < total) }
        });
    } catch (error) {
        next(error);
    }
};

const createUserLog = async (req, res, next) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(422).json({
                message: 'Hey! Invalid log....'
            });
        }

        const log = req.body;
        log.created = new Date();

        const { db = 'SBQC', source = 'userLogs' } = req.query;
        const dbs = req.app.locals.dbs;

        if (!dbs || !dbs[db]) {
            return res.status(500).json({ error: `Database '${db}' not found.` });
        }

        const logsdb = dbs[db].collection(source);
        const createdLog = await logsdb.insertOne(log);

        console.log(`Log document was inserted with the _id: ${createdLog.insertedId}`);
        res.status(201).json(createdLog);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getUserLogs,
    // Return counts grouped by country for a given collection
    getCountryCounts: async (req, res, next) => {
        try {
            const { source = 'userLogs', db = 'SBQC' } = req.query;
            const dbs = req.app.locals.dbs;
            if (!dbs || !dbs[db]) {
                return res.status(500).json({ error: `Database '${db}' not found.` });
            }
            const logsdb = dbs[db].collection(source);

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
    },
    createUserLog
};