const appEmitter = require('./eventEmitter');
const AppEvent = require('../models/appEventModel');

/**
 * Logs an event to the database and emits it for real-time updates.
 *
 * @param {string} message - The event message.
 * @param {string} type - The type of event (e.g., 'info', 'error', 'user').
 * @returns {Promise<void>}
 */
const logEvent = async (message, type = 'info') => {
    try {
        const newEvent = new AppEvent({ message, type });
        await newEvent.save();

        // Emit the event so other parts of the app (like SSE) can react
        appEmitter.emit('newEvent', newEvent.toObject());
        console.log(`Event logged and emitted: "${message}"`);
    } catch (error) {
        console.error(`Failed to log event: "${message}"`, error);
    }
};

module.exports = { logEvent };