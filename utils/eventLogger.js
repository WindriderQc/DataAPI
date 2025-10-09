const appEmitter = require('./eventEmitter');
const AppEvent = require('../models/appEventModel');

/**
 * Logs an event to the database and emits it for real-time updates.
 *
 * @param {string} message - The event message.
 * @param {string} type - The type of event (e.g., 'info', 'error', 'user').
 * @returns {Promise<void>}
 */
/**
 * Log and emit an application event.
 * @param {string} message
 * @param {string} type
 * @param {Object} [opts] - optional { stack, meta }
 */
const logEvent = async (message, type = 'info', opts = {}) => {
    try {
        const payload = { message, type };
        if (opts.stack) payload.stack = opts.stack;
        if (opts.meta) payload.meta = opts.meta;

        const newEvent = new AppEvent(payload);
        await newEvent.save();

        // Emit the full event object for SSE consumers
        appEmitter.emit('newEvent', newEvent.toObject());
        console.log(`Event logged and emitted: "${message}"`);
    } catch (error) {
        console.error(`Failed to log event: "${message}"`, error);
    }
};

module.exports = { logEvent };