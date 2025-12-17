const router = require('express').Router();
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const profileController = require('../controllers/profileController');
const { requireAdmin, attachUser } = require('../utils/auth');

// Apply attachUser middleware to populate res.locals.user for all routes
router.use(attachUser);

// User CRUD routes
router.get('/users', userController.index);
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

router.get('/users/fromEmail/:email', userController.fromEmail);
router.get('/users/:id', userController.view);
router.patch('/users/:id', userController.update);
router.put('/users/:id', userController.update);
router.delete('/users/:id', userController.delete);

// Profile management - admin only
router.get('/profiles', requireAdmin, profileController.listProfiles);
router.post('/profiles', requireAdmin, profileController.createProfile);
router.post('/users/:id/assign-profile', requireAdmin, profileController.assignProfileToUser);

module.exports = router;
