const { ObjectId } = require('mongodb');

const attachUser = async (req, res, next) => {
    console.log(`[MIDDLEWARE] attachUser: Req for [${req.originalUrl}] from origin [${req.headers.origin}] - Checking session with ID: ${req.sessionID}`);
    res.locals.user = null;
    if (req.session && req.session.userId) {
        console.log(`[MIDDLEWARE] attachUser: Session found with userId: ${req.session.userId}`);
        try {
            const dbs = req.app.locals.dbs;
            if (!dbs || !dbs.datas) {
                console.error('[MIDDLEWARE] attachUser: Database not available.');
                return next();
            }
            const usersCollection = dbs.datas.collection('users');
            if (!ObjectId.isValid(req.session.userId)) {
                console.error(`[MIDDLEWARE] attachUser: Invalid userId format: ${req.session.userId}`);
                return next();
            }
            const user = await usersCollection.findOne(
                { _id: new ObjectId(req.session.userId) },
                { projection: { password: 0 } }
            );
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