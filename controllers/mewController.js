const { BadRequest } = require('../utils/errors');

/**
 * Validates mew data according to business rules
 * @param {Object} mew - The mew object to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidMew(mew) {
    return mew.name && 
           mew.name.toString().trim() !== '' && 
           mew.name.toString().trim().length <= 50 &&
           mew.content && 
           mew.content.toString().trim() !== '' && 
           mew.content.toString().trim().length <= 140;
}

/**
 * GET /mews - Legacy endpoint, returns all mews (just the array)
 */
exports.getAllMews = async (req, res, next) => {
    try {
        const db = req.app.locals.dbs.mainDb;
        const mewsCollection = db.collection('mews');
        const mews = await mewsCollection.find({}).toArray();
        
        // Legacy endpoint expects just the array
        res.json(mews);
    } catch (err) {
        next(err);
    }
};

/**
 * GET /v2/mews - V2 endpoint with pagination and standardized response
 */
exports.getMewsV2 = async (req, res, next) => {
    try {
        let { skip = 0, limit = 5, sort = 'desc' } = req.query;
        skip = parseInt(skip) || 0;
        limit = parseInt(limit) || 5;

        // Validate and sanitize inputs
        skip = skip < 0 ? 0 : skip;
        limit = Math.min(50, Math.max(1, limit));
        
        // If limit was 0 or invalid, it becomes 1, not 5
        if (req.query.limit !== undefined) {
            const requestedLimit = parseInt(req.query.limit);
            if (requestedLimit <= 0) {
                limit = 1;
            }
        }

        const db = req.app.locals.dbs.mainDb;
        const mewsCollection = db.collection('mews');

        // Build sort order (default to newest first)
        const sortOrder = sort === 'asc' ? 1 : -1;

        const [total, mews] = await Promise.all([
            mewsCollection.countDocuments(),
            mewsCollection.find({})
                .sort({ _id: sortOrder })
                .skip(skip)
                .limit(limit)
                .toArray()
        ]);

        const has_more = skip + limit < total;

        // V2 endpoint expects { mews, meta }
        res.json({
            mews: mews,
            meta: {
                total,
                skip,
                limit,
                has_more
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /mews - Create a new mew (both legacy and v2)
 */
exports.createMew = async (req, res, next) => {
    try {
        if (!isValidMew(req.body)) {
            throw new BadRequest('Hey! Name and Content are required! Name cannot be longer than 50 characters. Content cannot be longer than 140 characters.');
        }

        const mewData = {
            name: req.body.name.toString().trim(),
            content: req.body.content.toString().trim(),
            created: new Date()
        };

        const db = req.app.locals.dbs.mainDb;
        const mewsCollection = db.collection('mews');
        const result = await mewsCollection.insertOne(mewData);

        const createdMew = { ...mewData, _id: result.insertedId };

        res.status(201).json({
            status: 'success',
            message: 'Mew created successfully',
            data: createdMew
        });
    } catch (err) {
        next(err);
    }
};

/**
 * GET / - Simple welcome message for the mew router
 */
exports.index = (req, res) => {
    res.json({
        message: 'Meower!'
    });
};
