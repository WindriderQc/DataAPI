const { NotFoundError } = require('../utils/errors');

exports.quakes = async (req, res, next) => {
    try {
        const db = req.app.locals.dbs.data;
        const quakesCollection = db.collection('quakes');
        const [count, quakes] = await Promise.all([
            quakesCollection.countDocuments(),
            quakesCollection.find({}).toArray()
        ]);
        res.json({ status: "success", message: 'Quakes retrieved successfully', meta: { count }, data: quakes });
    } catch (err) {
        next(err);
    }
};

exports.iss = async (req, res, next) => {
    try {
        const db = req.app.locals.dbs.data;
        const issCollection = db.collection('isses');
        const [total, data] = await Promise.all([
            issCollection.countDocuments({}),
            issCollection.find({}, { sort: { created: -1 } }).toArray()
        ]);
        res.json({ status: "success", message: 'Iss locations retrieved successfully', meta: { total }, data: data });
    } catch (err) {
        next(err);
    }
};

exports.deleteAllIss = async (req, res, next) => {
    try {
        const db = req.app.locals.dbs.data;
        const issCollection = db.collection('isses');
        const ack = await issCollection.deleteMany({});
        res.json({ status: "success", message: 'All Iss deleted', data: ack });
    } catch (err) {
        next(err);
    }
};

exports.deleteAllQuakes = async (req, res, next) => {
    try {
        const db = req.app.locals.dbs.data;
        const quakesCollection = db.collection('quakes');
        const ack = await quakesCollection.deleteMany({});
        res.json({ status: "success", message: 'All Quakes deleted', data: ack });
    } catch (err) {
        next(err);
    }
};