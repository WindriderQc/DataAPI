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
const { create: createProgress, emit: emitProgress, remove: removeProgress } = require('../utils/progressBus');
const { v4: uuidv4 } = require('uuid');

exports.copyProdToDev = async (req, res) => {
    const serverUrl = config.db.connectionString.replace(/\/[^/]+$/, '');
    const client = new MongoClient(serverUrl);

    // create a job id and progress emitter
    const jobId = uuidv4();
    const emitter = createProgress(jobId);

    // respond immediately with the job id so the client can open the SSE
    res.json({ status: 'started', jobId });

    // run copy in background
    (async () => {
        try {
            await client.connect();
            const sourceDb = client.db('datas');
            const destDb = client.db('devdatas');

            log('Starting database copy from PROD (datas) to DEV (devdatas)...');

            const sourceCollections = await sourceDb.listCollections().toArray();
            // enrich collections with document counts for per-collection progress
            const enriched = [];
            let totalDocs = 0;
            for (const c of sourceCollections) {
                const collName = c && c.name;
                if (!collName) continue;
                let cnt = 0;
                try { cnt = await sourceDb.collection(collName).countDocuments(); } catch (e) { cnt = 0; }
                enriched.push({ name: collName, count: cnt });
                totalDocs += cnt;
            }

            const totalCollections = enriched.length;
            let processedCollections = 0;
            let processedDocs = 0;

            // Emit initial progress summary
            emitProgress(jobId, 'progress', { processedCollections, totalCollections, currentCollection: null, currentCollectionTotal: 0, copiedInCollection: 0, processedDocs, totalDocs, overallPercent: 0 });

            for (const coll of enriched) {
                const collName = coll.name;
                if (!collName) {
                    log(`Skipping invalid collection entry from source DB: ${JSON.stringify(coll)}`, 'warn');
                    processedCollections++;
                    emitProgress(jobId, 'progress', { processedCollections, totalCollections, currentCollection: null, currentCollectionTotal: 0, copiedInCollection: 0, processedDocs, totalDocs, overallPercent: Math.round((processedDocs / Math.max(1, totalDocs)) * 100) });
                    continue;
                }

                try {
                    const sourceCollection = sourceDb.collection(collName);
                    const destCollection = destDb.collection(collName);

                    log(`Copying collection: ${collName}...`);
                    emitProgress(jobId, 'progress', { processedCollections, totalCollections, currentCollection: collName, currentCollectionTotal: coll.count, copiedInCollection: 0, processedDocs, totalDocs, overallPercent: Math.round((processedDocs / Math.max(1, totalDocs)) * 100), status: 'starting' });

                    // copy in batches to avoid memory spikes
                    const cursor = sourceCollection.find({});
                    await destCollection.deleteMany({});
                    let batch = [];
                    const BATCH_SIZE = 500;
                    let copied = 0;
                    while (await cursor.hasNext()) {
                        const doc = await cursor.next();
                        batch.push(doc);
                        if (batch.length >= BATCH_SIZE) {
                            const insertedCount = batch.length;
                            await destCollection.insertMany(batch);
                            copied += insertedCount;
                            // update processedDocs by the inserted amount (not cumulative)
                            processedDocs += insertedCount;
                            // ensure processedDocs doesn't exceed totalDocs
                            if (processedDocs > totalDocs) processedDocs = totalDocs;
                            batch = [];
                            // compute overall percent and clamp
                            let overallPercent = Math.round((processedDocs / Math.max(1, totalDocs)) * 100);
                            if (overallPercent > 100) overallPercent = 100;
                            const safeCopied = Math.min(copied, coll.count || copied);
                            emitProgress(jobId, 'progress', { processedCollections, totalCollections, currentCollection: collName, currentCollectionTotal: coll.count, copiedInCollection: safeCopied, processedDocs, totalDocs, overallPercent, status: 'partial' });
                        }
                    }
                    if (batch.length > 0) {
                        const insertedCount = batch.length;
                        await destCollection.insertMany(batch);
                        copied += insertedCount;
                        processedDocs += insertedCount;
                        if (processedDocs > totalDocs) processedDocs = totalDocs;
                    }

                    processedCollections++;
                    let overallPercent = Math.round((processedDocs / Math.max(1, totalDocs)) * 100);
                    if (overallPercent > 100) overallPercent = 100;
                    const safeCopied = Math.min(copied, coll.count || copied);
                    emitProgress(jobId, 'progress', { processedCollections, totalCollections, currentCollection: collName, currentCollectionTotal: coll.count, copiedInCollection: safeCopied, processedDocs, totalDocs, overallPercent, status: 'done' });
                    log(`Copied ${copied} documents to ${collName}.`);
                } catch (err) {
                    processedCollections++;
                    log(`Error copying collection ${collName}: ${err && err.message ? err.message : err}`, 'error');
                    emitProgress(jobId, 'progress', { processedCollections, totalCollections, currentCollection: collName, currentCollectionTotal: coll.count, copiedInCollection: 0, processedDocs, totalDocs, overallPercent: Math.round((processedDocs / Math.max(1, totalDocs)) * 100), status: 'error', error: err && err.message });
                    continue;
                }
            }

            emitProgress(jobId, 'complete', { processed: totalCollections, total: totalCollections, processedDocs, totalDocs });
            log('Database copy completed successfully.');
        } catch (error) {
            log(`Error copying database: ${error}`, 'error');
            emitProgress(jobId, 'error', { message: error && error.message });
        } finally {
            try { await client.close(); } catch (e) {}
            // cleanup emitter after short delay to allow client to fetch final events
            setTimeout(() => removeProgress(jobId), 30 * 1000);
        }
    })();
};