const User = require('../models/userModel');
const { BadRequest } = require('../utils/errors');

exports.register = async (req, res, next) => {
    const { name, email, password } = req.body;

    try {
        const user = new User({ name, email, password });
        await user.save();
        req.session.userId = user._id;
        res.redirect('/users');
    } catch (err) {
        if (err.code === 11000) {
            return next(new BadRequest('An account with this email already exists.'));
        }
        next(err);
    }
};

exports.login = async (req, res, next) => {
    const { email, password } = req.body;
    console.log(`[AUTH] Attempting login for email: ${email}`);

    try {
        const user = await User.findOne({ email });
        if (!user) {
            console.log(`[AUTH] Login failed: User not found for email: ${email}`);
            return res.status(401).render('login', { error: 'Invalid credentials' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log(`[AUTH] Login failed: Invalid password for email: ${email}`);
            return res.status(401).render('login', { error: 'Invalid credentials' });
        }

        console.log(`[AUTH] Login successful for user: ${user._id}. Regenerating session.`);

        req.session.regenerate(err => {
            if (err) {
                console.error('[AUTH] Error regenerating session:', err);
                return next(err);
            }

            req.session.userId = user._id;
            console.log(`[AUTH] Session userId set to: ${req.session.userId}`);
            console.log('[AUTH] Redirecting to /users...');

            req.session.save(err => {
                if (err) {
                    console.error('[AUTH] Error saving session:', err);
                    return next(err);
                }
                res.redirect('/users');
            });
        });

    } catch (err) {
        console.error('[AUTH] Error during login:', err);
        next(err);
    }
};

exports.logout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/users');
        }
        res.clearCookie(process.env.SESS_NAME || 'sid');
        res.redirect('/login');
    });
};