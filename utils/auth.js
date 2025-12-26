const { log } = require('./logger');
const Profile = require('../models/profileModel');

const attachUser = async (req, res, next) => {
    // log(`[MIDDLEWARE] attachUser: Checking session...`); 
    // Logging reduced to avoid noise, uncomment if debugging
    res.locals.user = null;
    if (req.session && req.session.userId) {
        try {
            const { User } = req.app.locals.models;
            if (!User) {
                // If models not yet loaded (e.g. very early boot), skip
                return next();
            }

            const user = await User.findById(req.session.userId);

            if (user) {
                // Attach as POJO for views
                res.locals.user = user.toObject();
                // delete password if present (toObject might keep it depending on schema options)
                delete res.locals.user.password;

                // Load Profile for RBAC (role, permissions, isAdmin)
                if (user.profileId) {
                    try {
                        const profile = await Profile.findById(user.profileId);
                        if (profile) {
                            // Attach role and permissions for RBAC middleware
                            res.locals.user.role = profile.role || 'user';
                            res.locals.user.permissions = profile.permissions || [];
                            // Legacy isAdmin support
                            res.locals.user.isAdmin = profile.isAdmin || profile.role === 'admin';
                        } else {
                            res.locals.user.role = 'user';
                            res.locals.user.permissions = [];
                            res.locals.user.isAdmin = false;
                        }
                    } catch (e) {
                        // profileId might be invalid format
                        log(`[MIDDLEWARE] attachUser: Profile lookup error: ${e.message}`, 'warn');
                        res.locals.user.role = 'user';
                        res.locals.user.permissions = [];
                        res.locals.user.isAdmin = false;
                    }
                } else {
                    res.locals.user.role = 'user';
                    res.locals.user.permissions = [];
                    res.locals.user.isAdmin = false;
                }
            }
        } catch (err) {
            log(`[MIDDLEWARE] attachUser: Error: ${err}`, 'error');
        }
    }
    next();
};


function requireAuth(req, res, next) {
    log(`[DEBUG] requireAuth: Path: ${req.originalUrl}, Session ID: ${req && req.sessionID ? req.sessionID : 'none'}`);

    // Allow tool-authenticated requests (e.g. from AgentX)
    if (res.locals.isToolAuthenticated) {
        return next();
    }

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