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

/**
 * Fetch raw AppEvent documents (unformatted) for admin/debug views.
 * @returns {Promise<Array>} Array of AppEvent objects
 */
exports.getRawFeedData = async () => {
    try {
        const events = await AppEvent.find({})
            .sort({ timestamp: -1 })
            .limit(200)
            .lean();
        return events;
    } catch (error) {
        console.error('Error fetching raw feed data:', error);
        return [];
    }
};

/**
 * Generic SSE handler factory which returns a handler that will only forward
 * events whose type is allowed by the provided predicate function.
 *
 * @param {(event:object)=>boolean} allowFn - predicate that returns true to forward the event
 */
/**
 * Default SSE handler which formats events for public display.
 */
const createSseHandler = (allowFn) => (req, res) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in Nginx
    res.flushHeaders(); // Flush the headers to establish the connection

    const sendEvent = (data) => {
        try {
            if (!allowFn || allowFn(data)) {
                const formattedData = formatEventForFeed(data);
                res.write(`data: ${JSON.stringify(formattedData)}\n\n`);
            }
        } catch (e) {
            // Don't let a single bad event crash the SSE connection
            console.error('Error sending feed event:', e);
        }
    };

    // Listen for new events and send them to the client
    const appEmitter = require('../utils/eventEmitter');
    appEmitter.on('newEvent', sendEvent);

    // Keep the connection open with heartbeat comments
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

// Public feed: filter out user-specific events so the public feed remains safe.
// User-specific types are 'user' and 'userLog' (see AppEvent enum).
exports.sendFeedEvents = createSseHandler((event) => {
    if (!event || !event.type) return true; // allow if no type
    const privateTypes = new Set(['user', 'userLog']);
    return !privateTypes.has(event.type);
});

/**
 * Full/Raw SSE handler for admin usage. Sends the entire AppEvent object
 * (including stack traces and extras) so ops can debug quickly. This must
 * only be exposed on protected routes (requireAuth).
 */
const createFullSseHandler = (allowFn) => (req, res) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in Nginx
    res.flushHeaders(); // Flush the headers to establish the connection

    const sendEvent = (data) => {
        try {
            if (!allowFn || allowFn(data)) {
                // send the full event object so the client can inspect stacks
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            }
        } catch (e) {
            console.error('Error sending raw feed event:', e);
        }
    };

    const appEmitter = require('../utils/eventEmitter');
    appEmitter.on('newEvent', sendEvent);

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 15000);

    req.on('close', () => {
        appEmitter.removeListener('newEvent', sendEvent);
        clearInterval(heartbeat);
        res.end();
        console.log('Private SSE client disconnected');
    });
};

// Private feed: includes all event types and sends raw AppEvent documents.
// Route protection must be applied at the router level.
exports.sendPrivateFeedEvents = createFullSseHandler(() => true);