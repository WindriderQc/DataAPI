/**
 * Flexible authentication middleware that accepts EITHER:
 * - Session-based authentication (for web UI)
 * - API key authentication (for external tools)
 */

const { requireAuth } = require('../utils/auth');
const { requireToolKey } = require('./toolAuth');

module.exports.requireEitherAuth = (req, res, next) => {
    // Check if API key is present
    const apiKey = req.header('x-api-key');
    
    if (apiKey) {
        // Use API key authentication
        return requireToolKey(req, res, next);
    } else {
        // Use session authentication
        return requireAuth(req, res, next);
    }
};
