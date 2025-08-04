const express = require('express');
const SessionAuthController = require('../Controllers/SessionAuthController');
const router = express.Router();
const authController = new SessionAuthController();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/profile', authController.protect, authController.getProfile);
router.post('/logout', authController.logout);
router.put('/change-password', authController.protect, authController.changePassword);
router.post('/forgot-password', authController.forgotPassword);
router.patch('/reset-password', authController.resetPassword);
module.exports = router;