const User = require('../models/userModel');
const { BadRequest } = require('../utils/errors');

exports.register = async (req, res, next) => {
    const { name, email, password } = req.body;

    try {
        const user = new User({ name, email, password });
        await user.save();
        req.session.userId = user._id;
        req.session.save((err) => {
            if (err) {
                return next(err);
            }
            res.redirect('/users');
        });
    } catch (err) {
        if (err.code === 11000) {
            return next(new BadRequest('An account with this email already exists.'));
        }
        next(err);
    }
};

exports.login = async (req, res, next) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).render('login', { error: 'Invalid credentials' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
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
      
        // Save the session before redirecting

         req.session.save(err => {
                if (err) {
                    console.error('[AUTH] Error saving session:', err);
                    return next(err);
                }
                res.redirect('/users');
            });
        });

    } catch (err) {
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