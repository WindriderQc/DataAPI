const { getDb, mongooseConnection } = require('../mongoDB');
const { mainDb, devDb } = require('../config/config').db;
const { create, get } = require('../utils/progressBus');
const { v4: uuidv4 } = require('uuid');
const { log } = require('../utils/logger');
const mongoose = require('mongoose');

/**
 * Gets metadata for a specific database.
 * @param {string} dbName - The name of the database.
 * @returns {Promise<object>} - An object containing database name and collections info.
 */
async function getDbInfo(dbName) {
    const db = mongooseConnection.useDb(dbName);
    const collections = await db.db.listCollections().toArray();
    const collectionsInfo = await Promise.all(
        collections.map(async (coll) => {
            const [count, stats] = await Promise.all([
                db.collection(coll.name).countDocuments(),
                db.collection(coll.name).stats(),
            ]);
            return {
                name: coll.name,
                count,
                size: stats.size,
                storageSize: stats.storageSize,
            };
        })
    );

    return {
        name: dbName,
        collections: collectionsInfo.sort((a, b) => a.name.localeCompare(b.name)),
    };
}

/**
 * Renders the database management page.
 */
exports.index = async (req, res, next) => {
    try {
        const [prodDbInfo, devDbInfo] = await Promise.all([
            getDbInfo(mainDb),
            getDbInfo(devDb),
        ]);
        res.render('databases', {
            title: 'Databases',
            prodDbInfo,
            devDbInfo,
        });
    } catch (error) {
        log.error('Failed to get database info:', error);
        next(error);
    }
};

/**
 * Initiates a job to copy all collections from the production database to the development database.
 */
exports.copyProdToDev = async (req, res) => {
    const jobId = uuidv4();
    const emitter = create(jobId);

    res.status(202).json({
        status: 'success',
        message: `Database copy job started.`,
        jobId: jobId
    });

    // Run the copy operation asynchronously.
    copyDatabase(mainDb, devDb, emitter).catch(err => {
        log.error(`[Job ${jobId}] Database copy failed:`, err);
        emitter.emit('error', {
            message: 'An unexpected error occurred during the copy process.',
            error: err.message,
        });
    });
};

/**
 * Copies all collections from a source database to a destination database using streaming.
 * @param {string} srcDbName - The name of the source database.
 * @param {string} destDbName - The name of the destination database.
 * @param {EventEmitter} emitter - An event emitter for progress updates.
 */
async function copyDatabase(srcDbName, destDbName, emitter) {
    const srcDb = mongooseConnection.useDb(srcDbName);
    const destDb = mongooseConnection.useDb(destDbName);

    const collections = await srcDb.db.listCollections().toArray();
    const totalCollections = collections.length;
    let processedCollections = 0;
    let totalDocs = 0;
    let processedDocs = 0;

    // First, get total document counts for accurate progress reporting
    for (const coll of collections) {
        totalDocs += await srcDb.collection(coll.name).countDocuments();
    }

    emitter.emit('progress', {
        status: 'starting',
        totalCollections,
        totalDocs,
        processedCollections: 0,
        processedDocs: 0,
        overallPercent: 0,
    });

    for (const coll of collections) {
        const collectionName = coll.name;
        const tempCollectionName = `${collectionName}_${Date.now()}_temp`;
        const srcCollection = srcDb.collection(collectionName);
        const destCollection = destDb.collection(tempCollectionName);
        const currentCollectionTotal = await srcCollection.countDocuments();
        let copiedInCollection = 0;

        try {
            const cursor = srcCollection.find({}, {
                timeout: false
            }); // Use a cursor to stream data

            for await (const doc of cursor) {
                await destCollection.insertOne(doc);
                copiedInCollection++;
                processedDocs++;

                // Throttle progress updates to avoid overwhelming the event bus
                if (copiedInCollection % 100 === 0 || copiedInCollection === currentCollectionTotal) {
                    emitter.emit('progress', {
                        status: 'in-progress',
                        totalCollections,
                        totalDocs,
                        processedCollections,
                        processedDocs,
                        currentCollection: collectionName,
                        currentCollectionTotal,
                        copiedInCollection,
                        overallPercent: totalDocs > 0 ? Math.round((processedDocs / totalDocs) * 100) : 0,
                    });
                }
            }

            // Drop the original collection and rename the temporary one
            try {
                await destDb.collection(collectionName).drop();
            } catch (err) {
                if (err.codeName !== 'NamespaceNotFound') {
                    throw err; // re-throw if it's not a "collection doesn't exist" error
                }
            }
            await destDb.renameCollection(tempCollectionName, collectionName);

            processedCollections++;
            emitter.emit('progress', {
                status: 'collection-complete',
                totalCollections,
                totalDocs,
                processedCollections,
                processedDocs,
                currentCollection: collectionName,
                overallPercent: totalDocs > 0 ? Math.round((processedDocs / totalDocs) * 100) : 0,
            });
        } catch (err) {
            log.error(`[Job ${emitter.jobId}] Error copying collection ${collectionName}:`, err);
            // Clean up temporary collection on error
            try {
                await destDb.collection(tempCollectionName).drop();
            } catch (cleanupErr) {
                log.error(`[Job ${emitter.jobId}] Failed to drop temporary collection ${tempCollectionName}:`, cleanupErr);
            }
            throw err; // Propagate error to the main catch block
        }
    }

    emitter.emit('complete', {
        status: 'complete',
        totalCollections,
        processedCollections,
        totalDocs,
        processedDocs,
    });
}