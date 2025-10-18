const { BadRequest } = require('../utils/errors');
const { log } = require('../utils/logger');

exports.registerLocation = async (req, res, next) => {
    const { lat, lon } = res.locals.user;
    const { dbs } = req.app.locals;
    const weatherLocationsCollection = dbs.mainDb.collection('weatherLocations');

    try {
        if (!lat || !lon) {
            return next(new BadRequest('User has no location set.'));
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