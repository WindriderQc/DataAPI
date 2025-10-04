const getDbInfo = async (db) => {
    if (!db) {
        return { name: 'Unknown', collections: [] };
    }
    const collectionInfos = [];
    const collections = await db.listCollections().toArray();
    for (const collection of collections) {
        const count = await db.collection(collection.name).countDocuments();
        collectionInfos.push({ name: collection.name, count });
    }
    return { name: db.databaseName, collections: collectionInfos };
};

module.exports = { getDbInfo };