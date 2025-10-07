const EventEmitter = require('events');

/**
 * A shared event emitter instance for application-wide events.
 * This allows different parts of the application to communicate without being directly coupled.
 * For example, a controller can emit a 'newEvent' event, and a separate SSE module can listen for it.
 */
class AppEmitter extends EventEmitter {}

module.exports = new AppEmitter();