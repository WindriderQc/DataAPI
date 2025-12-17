'use strict';

/**
 * Activity Logging Middleware
 * 
 * Logs authenticated user page views to userLogs collection
 * with location data from user profile for world map visualization.
 */

const { log } = require('../utils/logger');
const { ObjectId } = require('mongodb');

/**
 * Middleware to log authenticated user page views
 * Creates entries in userLogs collection with lat/lon from user profile
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
async function activityLogger(req, res, next) {
    // Only log authenticated web page requests (not API calls)
    const isWebPage = req.originalUrl && !req.originalUrl.startsWith('/api');
    const isAuthenticated = req.session && req.session.userId;
    
    if (!isWebPage || !isAuthenticated) {
        return next();
    }

    try {
        const db = req.app.locals.dbs.mainDb;
        if (!db) {
            log('[activityLogger] Database not available, skipping activity log', 'warn');
            return next();
        }

        const usersCollection = db.collection('users');
        const userLogsCollection = db.collection('userLogs');

        // Fetch user data to get lat/lon coordinates
        let user = null;
        try {
            user = await usersCollection.findOne({ _id: new ObjectId(req.session.userId) });
        } catch (err) {
            log(`[activityLogger] Error fetching user: ${err.message}`, 'warn');
        }

        // Create activity log entry
        const logEntry = {
            logType: 'page_view',
            client: req.session.userId,
            content: `Viewed ${req.originalUrl}`,
            host: req.hostname || req.get('host'),
            ip: req.ip || req.connection?.remoteAddress || 'unknown',
            userAgent: req.get('user-agent') || 'unknown',
            method: req.method,
            path: req.originalUrl,
            created: new Date()
        };

        // Add location data if available from user profile
        if (user) {
            if (user.lat !== undefined && user.lat !== null) {
                logEntry.lat = user.lat;
            }
            if (user.lon !== undefined && user.lon !== null) {
                logEntry.lon = user.lon;
            }
            if (user.country) {
                logEntry.country = user.country;
            }
            if (user.name) {
                logEntry.userName = user.name;
            }
        }

        // Insert log entry asynchronously (don't block request)
        userLogsCollection.insertOne(logEntry).catch(err => {
            log(`[activityLogger] Error inserting activity log: ${err.message}`, 'error');
        });

    } catch (err) {
        // Don't fail the request if logging fails
        log(`[activityLogger] Activity logging error: ${err.message}`, 'error');
    }

    next();
}

module.exports = { activityLogger };
