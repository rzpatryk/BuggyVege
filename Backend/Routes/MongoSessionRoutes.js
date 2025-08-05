const express = require('express');
const MongoSessionAuthController = require('./../Controllers/MongoSessionAuthController');
const MongoSessionProductController = require('../Controllers/ProductControllers/MongoSessionProductController');
const MongoSessionWalletController = require('../Controllers/WalletControllers/MongoSessionWalletController');
const router = express.Router();
const authController = new MongoSessionAuthController();
const productController = new MongoSessionProductController();
const walletController = new MongoSessionWalletController();
// Auth routes
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

// Wallet routes
router.get('/wallet/balance', authController.protect, walletController.getWalletBalance);
router.post('/wallet/deposit', authController.protect, walletController.depositToWallet);
router.get('/wallet/transactions', authController.protect, walletController.getTransactionHistory);
router.post('/wallet/purchase', authController.protect, walletController.purchaseWithWallet);
router.get('/wallet/orders', authController.protect, walletController.getOrderHistory);
router.get('/wallet/orders/:orderId', authController.protect, walletController.getOrderDetails);
router.post('/wallet/refund', authController.protect, walletController.refundOrder);
module.exports = router;