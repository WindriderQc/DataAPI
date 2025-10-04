'use strict';

/**
 * @fileoverview Controller for handling user and system logs.
 */

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

        const enrichedLogs = await Promise.all(logs.map(async (log) => {
            if (!log.CountryName && log.Latitude && log.Longitude) {
                try {
                    const apiKey = process.env.LOCATION_IQ_API;
                    const url = `https://us1.locationiq.com/v1/reverse.php?key=${apiKey}&lat=${log.Latitude}&lon=${log.Longitude}&format=json`;
                    const response = await fetch(url);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.address && data.address.country) {
                            log.CountryName = data.address.country;
                            log.CountryCode = data.address.country_code;
                        }
                    }
                } catch (err) {
                    console.error('Error fetching country from LocationIQ:', err);
                }
            }
            return log;
        }));

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
    createUserLog
};