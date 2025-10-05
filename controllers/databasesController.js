const { MongoClient } = require('mongodb');
const config = require('../config/config');
const { log } = require('../utils/logger');

// Helper function to get database stats
const getDbStats = async (db, collectionInfo) => {
    const stats = {
        name: db.databaseName,
        collections: [],
    };

    for (const collection of collectionInfo) {
        try {
            // collection entries may come in different shapes depending on how
            // app.locals.collectionInfo was populated. Support both { name: 'x' }
            // and { collection: 'x' } shapes, and fall back to the raw value.
            const collName = collection.name || collection.collection || collection;
            if (!collName) throw new Error('collection name undefined');

            const coll = db.collection(collName);

            // Some driver/builds may not expose collection.stats() as a function
            // (older/newer driver differences). Try coll.stats(), otherwise use
            // the database command fallback.
            const countPromise = coll.countDocuments();
            let statsPromise;
            if (typeof coll.stats === 'function') {
                statsPromise = coll.stats();
            } else {
                statsPromise = db.command({ collStats: collName });
            }

            const [count, collectionStats] = await Promise.all([countPromise, statsPromise]);

            stats.collections.push({
                name: collName,
                count: count,
                size: collectionStats.size,
                storageSize: collectionStats.storageSize,
            });
        } catch (error) {
            const collName = collection && (collection.name || collection.collection) || String(collection);
            log(`Could not retrieve stats for collection ${collName} in db ${db.databaseName}: ${error.message}`, 'error');
            stats.collections.push({
                name: collName,
                count: 'N/A',
                size: 'N/A',
                storageSize: 'N/A',
                error: error.message,
            });
        }
    }
    return stats;
};


/**
 * Renders the databases overview page.
 * Fetches stats for both production and development databases.
 */
exports.getDatabasesPage = async (req, res, next) => {
    const { collectionInfo } = req.app.locals;
    if (!collectionInfo) {
        return next(new Error('collectionInfo is not available in app.locals.'));
    }

    // Use the main connection string but remove the specific db name to connect to the server
    const serverUrl = config.db.connectionString.replace(/\/[^/]+$/, '');
    const client = new MongoClient(serverUrl);

    try {
        await client.connect();

        // Get handles for both databases
        const prodDb = client.db('datas');
        const devDb = client.db('devdatas');

        // Fetch stats in parallel
        const [prodDbInfo, devDbInfo] = await Promise.all([
            getDbStats(prodDb, collectionInfo),
            getDbStats(devDb, collectionInfo),
        ]);

        res.render('databases', {
            title: 'Database Management',
            prodDbInfo,
            devDbInfo,
        });
    } catch (error) {
        log(`Error fetching database stats: ${error}`, 'error');
        next(error);
    } finally {
        await client.close();
    }
};

/**
 * API endpoint to copy all collections from the production database to the development database.
 */
exports.copyProdToDev = async (req, res) => {
    const { collectionInfo } = req.app.locals;
    if (!collectionInfo) {
        return res.status(500).json({ status: 'error', message: 'collectionInfo is not available in app.locals.' });
    }

    const serverUrl = config.db.connectionString.replace(/\/[^/]+$/, '');
    const client = new MongoClient(serverUrl);

    try {
        await client.connect();
        const sourceDb = client.db('datas');
        const destDb = client.db('devdatas');

        log('Starting database copy from PROD (datas) to DEV (devdatas)...');

        for (const collection of collectionInfo) {
            const sourceCollection = sourceDb.collection(collection.name);
            const destCollection = destDb.collection(collection.name);

            log(`Copying collection: ${collection.name}...`);

            // Fetch all data from the source
            const data = await sourceCollection.find({}).toArray();

            // Clear the destination collection before inserting
            await destCollection.deleteMany({});

            // Insert data if there is any
            if (data.length > 0) {
                await destCollection.insertMany(data);
                log(`Copied ${data.length} documents to ${collection.name}.`);
            } else {
                log(`No documents to copy for collection: ${collection.name}.`);
            }
        }

        log('Database copy completed successfully.');
        res.json({ status: 'success', message: 'Production database copied to development successfully.' });

    } catch (error) {
        log(`Error copying database: ${error}`, 'error');
        res.status(500).json({ status: 'error', message: 'An error occurred during the database copy process.' });
    } finally {
        await client.close();
    }
};