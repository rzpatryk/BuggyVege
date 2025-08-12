const express = require('express');
const MysqlSessionAuthController = require('../Controllers/MysqlSessionAuthController');
const MysqlSessionProductController = require('../Controllers/ProductControllers/MysqlSessionProductController');
const MysqlSessionWalletController = require('../Controllers/WalletControllers/MysqlSessionWalletController');
const MysqlSessionReviewController = require('../Controllers/ReviewControllers/MysqlSessionReviewController');
const router = express.Router();
const authController = new MysqlSessionAuthController();
const productController = new MysqlSessionProductController();
const walletController = new MysqlSessionWalletController();
const reviewController = new MysqlSessionReviewController();
const { uploadReviewImages, uploadProductImages } = require('../Utils/multerConfig');
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
router.post('/addProducts', authController.protect, authController.restrict('admin'), uploadProductImages, productController.addProduct);
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

// Review routes
router.post('/reviews', authController.protect, uploadReviewImages, reviewController.createReview);
router.get('/products/:productId/reviews', reviewController.getProductReviews);
router.get('/reviews/my-reviews', authController.protect, reviewController.getUserReviews);
router.get('/reviews/products-to-review', authController.protect, reviewController.getProductsToReview);
router.put('/reviews/:reviewId', authController.protect, reviewController.updateReview);
router.delete('/reviews/:reviewId', authController.protect, reviewController.deleteReview);
router.post('/reviews/:reviewId/helpful', reviewController.markReviewHelpful);

// Admin review routes
router.get('/admin/reviews/pending', authController.protect, authController.restrict('admin'), reviewController.getPendingReviews);
router.put('/admin/reviews/:reviewId/moderate', authController.protect, authController.restrict('admin'), reviewController.moderateReview);

module.exports = router;