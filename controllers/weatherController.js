const { validationResult } = require('express-validator');
const { BadRequest } = require('../utils/errors');
const { log } = require('../utils/logger');

exports.registerLocation = async (req, res, next) => {
    // Validate input if provided
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ status: 'error', errors: errors.array() });
    }

    const { dbs } = req.app.locals;
    const weatherLocationsCollection = dbs.mainDb.collection('weatherLocations');

    let lat, lon;

    // Use provided location or fallback to user profile location
    if (req.body.lat !== undefined && req.body.lon !== undefined) {
        lat = parseFloat(req.body.lat);
        lon = parseFloat(req.body.lon);
    } else {
        lat = res.locals.user.lat;
        lon = res.locals.user.lon;
    }

    try {
        if (lat === undefined || lon === undefined || lat === null || lon === null) {
            return next(new BadRequest('No location provided and user has no default location set.'));
        }

        const existingLocation = await weatherLocationsCollection.findOne({ lat, lon });
        if (existingLocation) {
            return res.status(200).json({ status: 'success', message: 'Location already registered.' });
        }

        await weatherLocationsCollection.insertOne({ lat, lon });
        log(`[weatherController] New weather location registered: ${lat}, ${lon}`);
        res.status(201).json({ status: 'success', message: 'Location registered successfully.' });
    } catch (err) {
        next(err);
    }
};
