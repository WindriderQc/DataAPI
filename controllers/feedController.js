const moment = require('moment');

/**
 * Fetches the latest user logs and formats them for the feed.
 * @param {Db} db The database connection.
 * @param {number} limit The maximum number of items to fetch.
 * @returns {Promise<Array>} A promise that resolves to an array of feed items.
 */
const getUserLogsFeed = async (db, limit = 5) => {
    try {
        const userLogs = await db.collection('userLogs')
            .find({})
            .sort({ created: -1 })
            .limit(limit)
            .toArray();

        return userLogs.map(log => ({
            type: 'userLog',
            message: `New user activity from ${log.CountryName || 'an unknown location'}.`,
            timestamp: log.created,
            icon: 'fa-eye',
            color: 'primary'
        }));
    } catch (error) {
        console.error('Error fetching user logs feed:', error);
        return [];
    }
};

/**
 * Fetches and combines all feed data.
 * @param {Object} dbs The database connections object.
 * @returns {Promise<Array>} A promise that resolves to a sorted array of all feed items.
 */
exports.getFeedData = async (dbs) => {
    const mainDb = dbs.mainDb;
    if (!mainDb) {
        return [];
    }

    const userLogsFeed = await getUserLogsFeed(mainDb);

    // For now, we only have one feed source. This will be expanded later.
    const allFeeds = [...userLogsFeed];

    // Sort all feed items by timestamp in descending order
    allFeeds.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Format timestamps to be human-readable
    return allFeeds.map(item => ({
        ...item,
        timeAgo: moment(item.timestamp).fromNow()
    }));
};