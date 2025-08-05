const express = require('express');
const MysqlSessionAuthController = require('../Controllers/MysqlSessionAuthController');
const MysqlSessionProductController = require('../Controllers/ProductControllers/MysqlSessionProductController');
const router = express.Router();
const authController = new MysqlSessionAuthController();
const productController = new MysqlSessionProductController();
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/profile', authController.protect, authController.getProfile);
router.post('/logout', authController.logout);
router.put('/change-password', authController.protect, authController.changePassword);
router.post('/forgot-password', authController.forgotPassword);
router.patch('/reset-password', authController.resetPassword);

// Product routes
router.get('/products', productController.getAllProducts);
router.get('/products/:id', productController.getProduct);
router.get('/products/:id/reviews', productController.getProductWithReviews);
router.post('/addProducts', authController.protect, authController.restrict('admin'), productController.addProduct);
router.put('/updateProducts/:id', authController.protect, authController.restrict('admin'), productController.updateProduct);
router.delete('/deleteProducts/:id', authController.protect, authController.restrict('admin'), productController.deleteProduct);
module.exports = router;