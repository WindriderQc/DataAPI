const config = require('../config/config');
const { getDbInfo } = require('../utils/db-utils');

exports.getDatabasesView = async (req, res, next) => {
    try {
        const dbs = req.app.locals.dbs;
        const prodDbName = config.db.modelDbName;
        const devDbName = 'devDatas'; // As per requirement

        const prodDbInfo = await getDbInfo(dbs[prodDbName]);
        const devDbInfo = await getDbInfo(dbs[devDbName]);

        res.render('databases', {
            title: 'Databases',
            prodDbInfo,
            devDbInfo,
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