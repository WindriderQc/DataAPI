const User = require('../models/userModel');

const attachUser = async (req, res, next) => {
    console.log(`[MIDDLEWARE] attachUser: Checking session with ID: ${req.sessionID}`);
    res.locals.user = null; // Ensure user is always defined in views
    if (req.session && req.session.userId) {
        console.log(`[MIDDLEWARE] attachUser: Session found with userId: ${req.session.userId}`);
        try {
            const user = await User.findById(req.session.userId).select('-password');
            if (user) {
                console.log(`[MIDDLEWARE] attachUser: User ${user.email} attached to res.locals.`);
                res.locals.user = user;
            } else {
                console.log(`[MIDDLEWARE] attachUser: User with ID ${req.session.userId} not found.`);
            }
        } catch (err) {
            console.error('[MIDDLEWARE] attachUser: Error attaching user:', err);
        }
    } else {
        console.log('[MIDDLEWARE] attachUser: No session or userId found.');
    }
    next();
};

const requireAuth = (req, res, next) => {
    console.log(`[MIDDLEWARE] requireAuth: Checking auth for path: ${req.path}`);
    if (!req.session || !req.session.userId) {
        console.log('[MIDDLEWARE] requireAuth: No userId in session. Redirecting to /login.');
        return res.redirect('/login');
    }
    console.log(`[MIDDLEWARE] requireAuth: Authentication successful for userId: ${req.session.userId}`);
    next();
};

module.exports = { attachUser, requireAuth };