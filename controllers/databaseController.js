const config = require('../config/config');

exports.getDatabasesView = async (req, res, next) => {
    try {
        const { collectionInfo } = req.app.locals;

        // Group collections by database
        const databases = collectionInfo.reduce((acc, { db, collection, count }) => {
            if (!acc[db]) {
                acc[db] = [];
            }
            acc[db].push({ name: collection, count });
            return acc;
        }, {});

        res.render('databases', {
            title: 'Databases',
            databases,
        });
    } catch (err) {
        next(err);
    }
};

exports.copyProdToDev = async (req, res, next) => {
    try {
        const dbs = req.app.locals.dbs;
        const prodDbName = config.db.modelDbName;
        const devDbName = 'devDatas'; // As per requirement
        const sourceDb = dbs[prodDbName];
        const destDb = dbs[devDbName];

        const collections = await sourceDb.listCollections().toArray();

        for (const collection of collections) {
            const sourceCollection = sourceDb.collection(collection.name);
            const destCollection = destDb.collection(collection.name);

            await destCollection.deleteMany({});
            const cursor = sourceCollection.find();
            const docs = await cursor.toArray();
            if(docs.length > 0) {
                await destCollection.insertMany(docs);
            }
        }

        res.status(200).json({ status: 'success', message: 'Production database copied to development successfully.' });
    } catch (err) {
        next(err);
    }
};