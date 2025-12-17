const router = require('express').Router();
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const profileController = require('../controllers/profileController');
const { requireAdmin, requireAuth, attachUser } = require('../utils/auth');

// Apply attachUser middleware to populate res.locals.user for all routes
router.use(attachUser);

// Apply requireAuth to protect all routes except public user creation
router.get('/users', requireAuth, userController.index);
router.post('/users', [
    body('name').trim().notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('confirmPassword').custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error('Passwords do not match');
        }
        return true;
    })
], userController.new);

router.get('/users/fromEmail/:email', requireAuth, userController.fromEmail);
router.get('/users/:id', requireAuth, userController.view);
router.patch('/users/:id', requireAuth, userController.update);
router.put('/users/:id', requireAuth, userController.update);
router.delete('/users/:id', requireAuth, userController.delete);

// Profile management - admin only
router.get('/profiles', requireAuth, requireAdmin, profileController.listProfiles);
router.post('/profiles', requireAuth, requireAdmin, profileController.createProfile);
router.post('/users/:id/assign-profile', requireAuth, requireAdmin, profileController.assignProfileToUser);

module.exports = router;
