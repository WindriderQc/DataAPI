const util = require('util');
const bcrypt = require('bcrypt');
const { BadRequest } = require('../utils/errors');
const { log } = require('../utils/logger');
const config = require('../config/config');

exports.register = async (req, res, next) => {
    const { name, email, password } = req.body;
    const dbs = req.app.locals.dbs;
    const dbName = config.db.modelDbName;
    const usersCollection = dbs[dbName].collection('users');

    try {
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
            return next(new BadRequest('An account with this email already exists.'));
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const result = await usersCollection.insertOne({ name, email, password: hashedPassword });
        const user = { _id: result.insertedId };

        const save = util.promisify(req.session.save).bind(req.session);
        req.session.userId = user._id.toString();
        await save();

        res.redirect('/login');
    } catch (err) {
        if (err.code === 11000) {
            return next(new BadRequest('An account with this email already exists.'));
        }
        next(err);
    }
};

exports.login = async (req, res, next) => {
    const { email, password } = req.body;
    const dbs = req.app.locals.dbs;
    const dbName = config.db.modelDbName;
    const usersCollection = dbs[dbName].collection('users');
    log(`[AUTH] Attempting login for email: ${email}`);

    try {
        const user = await usersCollection.findOne({ email });
        if (!user) {
            log(`[AUTH] Login failed: User not found for email: ${email}`);
            return res.status(401).render('login', { error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            log(`[AUTH] Login failed: Invalid password for email: ${email}`);
            return res.status(401).render('login', { error: 'Invalid credentials' });
        }

        log(`[AUTH] Login successful for user: ${user._id}. Regenerating session.`);
        const returnTo = req.session.returnTo;

        // Use callbacks for session manipulation to ensure sequential execution
        req.session.regenerate((err) => {
            if (err) return next(err);

            // Store user information in the new session
            req.session.userId = user._id.toString();

            // Save the session before responding
            req.session.save((err) => {
                if (err) return next(err);

                log(`[AUTH] Session userId set to: ${req.session.userId}`);
                const redirectUrl = returnTo || '/users';
                log(`[AUTH] Redirecting to ${redirectUrl}...`);
                res.redirect(redirectUrl);
            });
        });

    } catch (err) {
        log(`[AUTH] Error during login: ${err}`, 'error');
        next(err);
    }
};

exports.logout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/users');
        }
        res.clearCookie(process.env.SESS_NAME || 'sid');
        res.redirect('/');
    });
};