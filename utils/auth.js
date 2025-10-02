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
            const modelDbName = config.db.modelDbName;
            if (!dbs || !dbs[modelDbName]) {
                log(`[MIDDLEWARE] attachUser: Database '${modelDbName}' not available.`, 'error');
                return next();
            }
            const usersCollection = dbs[modelDbName].collection('users');
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

const requireAuth = (req, res, next) => {
    log(`[DEBUG] requireAuth: Path: ${req.originalUrl}, Session ID: ${req.sessionID}`);
    if (!req.session || !req.session.userId) {
        log(`[DEBUG] requireAuth: No user ID. Setting returnTo: ${req.originalUrl}`);
        req.session.returnTo = req.originalUrl;

        req.session.save(err => {
            if (err) {
                log(`[DEBUG] requireAuth: ERROR SAVING SESSION: ${err}`, 'error');
                return next(err);
            }
            log(`[DEBUG] requireAuth: Session saved. Redirecting to /login. Session: ${JSON.stringify(req.session)}`);
            res.redirect('/login');
        });
    } else {
        log(`[DEBUG] requireAuth: Auth successful. User ID: ${req.session.userId}`);
        next();
    }
};

module.exports = { attachUser, requireAuth };