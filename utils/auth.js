const { ObjectId } = require('mongodb');
const { log } = require('./logger');
const config = require('../config/config');

const attachUser = async (req, res, next) => {
    log(`[MIDDLEWARE] attachUser: Req for [${req.originalUrl}] from origin [${req.headers.origin}] - Checking session with ID: ${req.sessionID}`);
    log(`[MIDDLEWARE] attachUser: Full session object: ${JSON.stringify(req.session)}`);
    res.locals.user = null;
    if (req.session && req.session.userId) {
        log(`[MIDDLEWARE] attachUser: Session found with userId: ${req.session.userId}`);
        try {
            const dbs = req.app.locals.dbs;
            const modelDbName = config.db.mainDb; // main application DB
            if (!dbs || !dbs.mainDb) {
                log(`[MIDDLEWARE] attachUser: Database 'mainDb' not available.`, 'error');
                return next();
            }
            const usersCollection = dbs.mainDb.collection('users');
            if (!ObjectId.isValid(req.session.userId)) {
                log(`[MIDDLEWARE] attachUser: Invalid userId format: ${req.session.userId}`, 'error');
                return next();
            }
            const user = await usersCollection.findOne(
                { _id: new ObjectId(req.session.userId) },
                { projection: { password: 0 } }
            );
            if (user) {
                log(`[MIDDLEWARE] attachUser: User ${user.email} attached to res.locals.`);
                res.locals.user = user;
                // attempt to load profile to determine admin flag
                try {
                    if (user.profileId) {
                        const profilesColl = dbs.mainDb.collection('profiles');
                        const profile = await profilesColl.findOne({ _id: new ObjectId(user.profileId) });
                        if (profile && profile.isAdmin) {
                            res.locals.user.isAdmin = true;
                        } else {
                            res.locals.user.isAdmin = false;
                        }
                    } else {
                        res.locals.user.isAdmin = false;
                    }
                } catch (e) {
                    log(`[MIDDLEWARE] attachUser: Error loading profile: ${e}`, 'warn');
                    res.locals.user.isAdmin = false;
                }
            } else {
                log(`[MIDDLEWARE] attachUser: User with ID ${req.session.userId} not found.`);
            }
        } catch (err) {
            log(`[MIDDLEWARE] attachUser: Error attaching user: ${err}`, 'error');
        }
    } else {
        log('[MIDDLEWARE] attachUser: No session or userId found.');
    }
    next();
};

function requireAuth(req, res, next) {
    log(`[DEBUG] requireAuth: Path: ${req.originalUrl}, Session ID: ${req && req.sessionID ? req.sessionID : 'none'}`);

    const wantsEventStream = req && req.headers && req.headers.accept && req.headers.accept.includes('text/event-stream');
    const isApiRequest = req && req.originalUrl && req.originalUrl.startsWith('/api');

    // If session middleware isn't present, avoid throwing. For API/SSE clients return 401,
    // for web clients redirect to login.
    if (!req.session) {
        console.warn('[auth] req.session is undefined. Ensure express-session is applied before routes that use requireAuth.');
        if (wantsEventStream) {
            // For EventSource, send a simple 401 without HTML so the client gets a predictable error
            res.status(401).send('Unauthorized');
            return;
        }
        if (isApiRequest) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }
        return res.redirect('/login');
    }

    if (!req.session.userId) {
        log(`[DEBUG] requireAuth: No user ID for session. Path: ${req.originalUrl}`);

        // For API or EventSource requests, do not attempt to set returnTo or redirect to HTML login.
        if (wantsEventStream) {
            res.status(401).send('Unauthorized');
            return;
        }
        if (isApiRequest) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        // For regular web requests, set returnTo and redirect to login if possible
        try {
            req.session.returnTo = req.originalUrl || req.url;
        } catch (e) {
            log('[auth] Failed to set returnTo on session: ' + e, 'warn');
        }

        if (typeof req.session.save === 'function') {
            req.session.save(err => {
                if (err) {
                    log(`[DEBUG] requireAuth: ERROR SAVING SESSION: ${err}`, 'error');
                    return next(err);
                }
                log(`[DEBUG] requireAuth: Session saved. Redirecting to /login.`);
                return res.redirect('/login');
            });
        } else {
            return res.redirect('/login');
        }
    } else {
        log(`[DEBUG] requireAuth: Auth successful. User ID: ${req.session.userId}`);
        return next();
    }
};

module.exports = { attachUser, requireAuth };
// requireAdmin: for routes that must be admin-only
function requireAdmin(req, res, next) {
    // user should have been attached by attachUser middleware
    if (res && res.locals && res.locals.user && res.locals.user.isAdmin) {
        return next();
    }
    const wantsEventStream = req && req.headers && req.headers.accept && req.headers.accept.includes('text/event-stream');
    const isApiRequest = req && req.originalUrl && req.originalUrl.startsWith('/api');
    if (wantsEventStream || isApiRequest) {
        return res.status(403).json ? res.status(403).json({ status: 'error', message: 'Forbidden' }) : res.status(403).send('Forbidden');
    }
    return res.redirect('/login');
}

module.exports.requireAdmin = requireAdmin;