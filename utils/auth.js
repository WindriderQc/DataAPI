const User = require('../models/userModel');

const attachUser = async (req, res, next) => {
    if (req.session.userId) {
        try {
            const user = await User.findById(req.session.userId).select('-password');
            if (user) {
                res.locals.user = user; // Make user available in all views
            }
        } catch (err) {
            console.error('Error attaching user:', err);
        }
    }
    next();
};

const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    next();
};

module.exports = { attachUser, requireAuth };