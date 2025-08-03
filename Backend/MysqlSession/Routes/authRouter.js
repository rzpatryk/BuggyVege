const express = require('express');
const authController = require('../Controllers/authController');

const router = express.Router();
router.route('/signup').post(authController.signup);
router.route('/login').post(authController.login);

// Chroniony endpoint do sprawdzenia profilu
router.route('/profile').get(authController.protect, authController.getProfile);
router.route('/profile/test/:userId').get(authController.getProfileTest);
router.route('/forgot-password').post(authController.forgotPassword);
router.route('/reset-password').post(authController.resetPassword);
router.route('/change-password').post(authController.protect, authController.changePassword);
module.exports = router;