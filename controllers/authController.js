const util = require('util');
const bcrypt = require('bcrypt');
const { BadRequest } = require('../utils/errors');
const { log } = require('../utils/logger');
const config = require('../config/config');
const { logEvent } = require('../utils/eventLogger');
const { normalizeCountryData } = require('../utils/location-normalizer');

exports.register = async (req, res, next) => {
    const { name, email, password, confirmPassword } = req.body;
    const { dbs } = req.app.locals;
    const usersCollection = dbs.mainDb.collection('users');

    try {
        // Validate password confirmation
        if (password !== confirmPassword) {
            return next(new BadRequest('Passwords do not match.'));
        }
        
        // Validate password length
        if (password.length < 6) {
            return next(new BadRequest('Password must be at least 6 characters long.'));
        }
        
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
            return next(new BadRequest('An account with this email already exists.'));
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Check if this is the first user (make them admin automatically)
        const userCount = await usersCollection.countDocuments();
        const isFirstUser = userCount === 0;

        let newUser = { name, email, password: hashedPassword };

        // If first user, create admin profile and assign it
        if (isFirstUser) {
            const profilesCollection = dbs.mainDb.collection('profiles');
            
            // Check if admin profile exists, create if not
            let adminProfile = await profilesCollection.findOne({ profileName: 'Admin', isAdmin: true });
            if (!adminProfile) {
                const profileResult = await profilesCollection.insertOne({
                    profileName: 'Admin',
                    isAdmin: true,
                    config: []
                });
                adminProfile = { _id: profileResult.insertedId };
                log('[AUTH] Created Admin profile for first user');
            }
            
            // Assign admin profile to first user
            newUser.profileId = adminProfile._id;
            log('[AUTH] First user registered - automatically assigned Admin profile');
        }

        const result = await usersCollection.insertOne(newUser);
        const user = { _id: result.insertedId, name };

        // Log the registration event
        logEvent(`New user registered: ${user.name}${isFirstUser ? ' (First user - Admin)' : ''}`, 'user');

        req.session.userId = user._id.toString();
        req.session.save(err => {
            if (err) return next(err);
            res.redirect('/login');
        });
    } catch (err) {
        if (err.code === 11000) {
            return next(new BadRequest('An account with this email already exists.'));
        }
        next(err);
    }
};

exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
    // Use the main application database connection directly
    const db = req.app.locals.dbs.mainDb;
        const usersCollection = db.collection('users');
        log(`[AUTH] Attempting login for email: ${email}`);

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

        log(`[AUTH] Login successful for user: ${user._id}.`);
        
        // Enrich user location with CountryName if not already cached
        if ((user.lat !== undefined && user.lon !== undefined) && !user.CountryName) {
            try {
                const enriched = await normalizeCountryData(user, db, 'users', user._id);
                if (enriched.CountryName) {
                    await usersCollection.updateOne(
                        { _id: user._id },
                        { $set: { CountryName: enriched.CountryName } }
                    );
                    user.CountryName = enriched.CountryName;
                    log(`[AUTH] Enriched user location: ${enriched.CountryName}`);
                }
            } catch (err) {
                log(`[AUTH] Location enrichment failed: ${err.message}`, 'warn');
            }
        }
        
        log(`[DEBUG] PRE-REGENERATE: Session ID: ${req.sessionID}, Session: ${JSON.stringify(req.session)}`);
        const returnTo = req.session.returnTo;

        req.session.regenerate((err) => {
            if (err) {
                log(`[DEBUG] login: ERROR REGENERATING SESSION: ${err}`, 'error');
                return next(err);
            }
            log(`[DEBUG] POST-REGENERATE: New Session ID: ${req.sessionID}`);

            req.session.userId = user._id.toString();
            req.session.returnTo = returnTo;
            log(`[DEBUG] SESSION TO BE SAVED: ${JSON.stringify(req.session)}`);

            req.session.save((err) => {
                if (err) {
                    log(`[DEBUG] login: ERROR SAVING SESSION: ${err}`, 'error');
                    return next(err);
                }
                log(`[DEBUG] SESSION SAVED. Cookie: ${JSON.stringify(req.session.cookie)}`);
                const redirectUrl = req.session.returnTo || '/users';
                log(`[DEBUG] Redirecting to ${redirectUrl}...`);
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
            log(`Error destroying session: ${err}`, 'error');
        }
        res.clearCookie(config.session.name);
        res.redirect('/');
    });
};