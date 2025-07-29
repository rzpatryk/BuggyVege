const express = require('express');
const authController = require('../MysqlControllers/authController');

const router = express.Router();
router.route('/signup').post(authController.signup);
router.route('/login').post(authController.login);

// Chroniony endpoint do sprawdzenia profilu
router.route('/profile').get(authController.protect, authController.getProfile);
router.route('/profile/test/:userId').get(authController.getProfileTest);

module.exports = router;