const util = require('util');
const bcrypt = require('bcrypt');
const { BadRequest } = require('../utils/errors');
const { log } = require('../utils/logger');
const config = require('../config/config');
const { logEvent } = require('../utils/eventLogger');
const { normalizeCountryData } = require('../utils/location-normalizer');
const Profile = require('../models/profileModel');

exports.register = async (req, res, next) => {
    const { name, email, password, confirmPassword } = req.body;
    const { User } = req.app.locals.models; // Use Mongoose Model

    try {
        // Validate password confirmation
        if (password !== confirmPassword) {
            return next(new BadRequest('Passwords do not match.'));
        }

        // Validate password length
        if (password.length < 6) {
            return next(new BadRequest('Password must be at least 6 characters long.'));
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return next(new BadRequest('An account with this email already exists.'));
        }

        // Check if this is the first user (make them admin automatically)
        const userCount = await User.countDocuments();
        const isFirstUser = userCount === 0;

        // Create Mongoose instance (will handle hashing on save)
        const newUser = new User({ name, email, password });

        // If first user, create admin profile and assign it
        if (isFirstUser) {
            // Check if admin profile exists, create if not (using Mongoose)
            let adminProfile = await Profile.findOne({ profileName: 'Admin', isAdmin: true });
            if (!adminProfile) {
                adminProfile = new Profile({
                    profileName: 'Admin',
                    role: 'admin',
                    permissions: ['read', 'write', 'delete', 'admin', 'manage_users', 'manage_profiles', 'view_logs', 'export_files'],
                    isAdmin: true,
                    config: []
                });
                await adminProfile.save();
                log('[AUTH] Created Admin profile for first user');
            }

            // Assign admin profile to first user
            newUser.profileId = adminProfile._id.toString();
            log('[AUTH] First user registered - automatically assigned Admin profile');
        }

        await newUser.save(); // Triggers pre-save hook for password hashing

        // Log the registration event
        logEvent(`New user registered: ${newUser.name}${isFirstUser ? ' (First user - Admin)' : ''}`, 'user');

        req.session.userId = newUser._id.toString();
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
        const { User } = req.app.locals.models; // Use Mongoose Model
        const { dbs } = req.app.locals; // Keep dbs for location enrichment helper if needed

        log(`[AUTH] Attempting login for email: ${email}`);

        const user = await User.findOne({ email });
        if (!user) {
            log(`[AUTH] Login failed: User not found for email: ${email}`);
            return res.status(401).render('login', { error: 'Invalid credentials' });
        }

        // Use model method
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            log(`[AUTH] Login failed: Invalid password for email: ${email}`);
            return res.status(401).render('login', { error: 'Invalid credentials' });
        }

        log(`[AUTH] Login successful for user: ${user._id}.`);

        // Enrich user location with CountryName if not already cached
        if ((user.lat !== undefined && user.lon !== undefined) && !user.CountryName) {
            try {
                const db = dbs.mainDb; // helper needs native db
                const enriched = await normalizeCountryData(user.toObject(), db, 'users', user._id);
                if (enriched.CountryName) {
                    // Model update
                    user.CountryName = enriched.CountryName;
                    await user.save();
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