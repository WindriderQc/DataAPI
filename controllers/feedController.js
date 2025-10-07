const moment = require('moment');
const AppEvent = require('../models/appEventModel');

/**
 * Maps an AppEvent document to a feed item format.
 * @param {object} event - The AppEvent document from the database.
 * @returns {object} A formatted feed item.
 */
const formatEventForFeed = (event) => {
    const iconMap = {
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle',
        error: 'fa-bell',
        success: 'fa-check-circle',
        user: 'fa-user',
        device: 'fa-share-alt',
        userLog: 'fa-eye'
    };

    const colorMap = {
        info: 'info',
        warning: 'warning',
        error: 'danger',
        success: 'success',
        user: 'primary',
        device: 'success',
        userLog: 'primary'
    };

    return {
        message: event.message,
        timestamp: event.timestamp,
        timeAgo: moment(event.timestamp).fromNow(),
        icon: iconMap[event.type] || 'fa-info-circle',
        color: colorMap[event.type] || 'secondary'
    };
};

/**
 * Fetches the initial feed data from the AppEvents collection.
 * This is used to populate the feed when the page first loads.
 *
 * @returns {Promise<Array>} A promise that resolves to a sorted array of feed items.
 */
exports.getFeedData = async () => {
    try {
        const events = await AppEvent.find({})
            .sort({ timestamp: -1 })
            .limit(50)
            .lean(); // Use .lean() for faster, plain JS objects

        return events.map(formatEventForFeed);
    } catch (error) {
        console.error('Error fetching initial feed data:', error);
        return [];
    }
};

const sendFeedEvents = (req, res) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Flush the headers to establish the connection

    const sendEvent = (data) => {
        const formattedData = formatEventForFeed(data);
        res.write(`data: ${JSON.stringify(formattedData)}\n\n`);
    };

    // Listen for new events and send them to the client
    const appEmitter = require('../utils/eventEmitter');
    appEmitter.on('newEvent', sendEvent);

    // Keep the connection open
    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 15000); // Send a comment every 15 seconds to prevent timeout

    // Clean up when the client disconnects
    req.on('close', () => {
        appEmitter.removeListener('newEvent', sendEvent);
        clearInterval(heartbeat);
        res.end();
        console.log('SSE client disconnected');
    });
};

exports.sendFeedEvents = sendFeedEvents;