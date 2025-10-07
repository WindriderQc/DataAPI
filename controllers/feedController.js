const moment = require('moment');
const mongoose = require('mongoose');

// Helper function to create a User model instance for the correct connection
const getUserModel = (db) => require('../models/userModel')(db.client);

/**
 * Fetches the latest user logs and formats them for the feed.
 * @param {Db} db The main database connection.
 * @param {number} limit The maximum number of items to fetch.
 * @returns {Promise<Array>} An array of feed items.
 */
const getUserLogsFeed = async (db, limit) => {
    try {
        const userLogs = await db.collection('userLogs')
            .find({})
            .sort({ created: -1 })
            .limit(limit)
            .toArray();

        return userLogs.map(log => ({
            type: 'userLog',
            message: `New activity from ${log.CountryName || 'an unknown location'}.`,
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
 * Generates a feed of application events.
 * In the future, this could come from a dedicated events collection.
 * @returns {Promise<Array>} An array of feed items.
 */
const getAppEventsFeed = async () => {
    // This is a placeholder. Real events would be stored and fetched from the DB.
    return [
        {
            type: 'event',
            message: 'CPU usage is high on server-02.',
            timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 mins ago
            icon: 'fa-laptop',
            color: 'danger'
        },
        {
            type: 'event',
            message: 'Database backup completed successfully.',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
            icon: 'fa-database',
            color: 'success'
        }
    ];
};

/**
 * Fetches the latest registered devices.
 * @param {Db} db The main database connection.
 * @param {number} limit The maximum number of items to fetch.
 * @returns {Promise<Array>} An array of feed items.
 */
const getDevicesFeed = async (db, limit) => {
    try {
        const devices = await db.collection('devices')
            .find({})
            .sort({ lastBoot: -1 })
            .limit(limit)
            .toArray();
        return devices.map(device => ({
            type: 'device',
            message: `New device '${device.id}' registered.`,
            timestamp: device.lastBoot,
            icon: 'fa-share-alt',
            color: 'success'
        }));
    } catch (error) {
        console.error('Error fetching devices feed:', error);
        return [];
    }
};

/**
 * Fetches the latest registered users.
 * @param {Db} db The main database connection.
 * @param {number} limit The maximum number of items to fetch.
 * @returns {Promise<Array>} An array of feed items.
 */
const getUsersFeed = async (db, limit) => {
    try {
        const User = getUserModel(db);
        const users = await User.find({})
            .sort({ creationDate: -1 })
            .limit(limit)
            .lean(); // Use .lean() for faster, plain JS objects

        return users.map(user => ({
            type: 'user',
            message: `Welcome to our new user: ${user.name}!`,
            timestamp: user.creationDate,
            icon: 'fa-user',
            color: 'warning'
        }));
    } catch (error) {
        console.error('Error fetching users feed:', error);
        return [];
    }
};


/**
 * Fetches, combines, and sorts all feed data.
 * @param {Object} dbs The database connections object.
 * @returns {Promise<Array>} A sorted array of all feed items.
 */
exports.getFeedData = async (dbs) => {
    const mainDb = dbs.mainDb;
    if (!mainDb) {
        return [];
    }

    const limit = 50; // Fetch up to 50 items per feed source

    // Fetch all feeds in parallel
    const [
        userLogsFeed,
        appEventsFeed,
        devicesFeed,
        usersFeed
    ] = await Promise.all([
        getUserLogsFeed(mainDb, limit),
        getAppEventsFeed(), // This one is static for now
        getDevicesFeed(mainDb, limit),
        getUsersFeed(mainDb, limit)
    ]);

    // Combine all feed items into one array
    const allFeeds = [
        ...userLogsFeed,
        ...appEventsFeed,
        ...devicesFeed,
        ...usersFeed
    ];

    // Sort all feed items by timestamp in descending order
    allFeeds.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Take the most recent 50 items overall
    const recentFeeds = allFeeds.slice(0, limit);

    // Format timestamps to be human-readable
    return recentFeeds.map(item => ({
        ...item,
        timeAgo: moment(item.timestamp).fromNow()
    }));
};