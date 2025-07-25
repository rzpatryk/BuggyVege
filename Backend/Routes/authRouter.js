const express = require('express');
const authController = require('./../Controllers/authController');

const router = express.Router();
router.route('/signup').post(authController.signup);
router.route('/login').post(authController.login);

// Chroniony endpoint do sprawdzenia profilu
router.route('/profile').get(authController.protect, authController.getProfile);

module.exports = router;