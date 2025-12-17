const router = require('express').Router();
const authController = require('../controllers/authController');

// Render login and register pages
router.get('/login', (req, res) => res.render('login', { error: null }));
router.get('/register', (req, res) => res.render('register'));

// Handle login, register, and logout
router.post('/login', authController.login);
router.post('/register', authController.register);
router.get('/logout', authController.logout);

module.exports = router;