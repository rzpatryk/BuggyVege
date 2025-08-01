const express = require('express');
const reviewController = require('../Controllers/reviewController');
const authController = require('../Controllers/authController');

const router = express.Router();

// Publiczne endpointy
router.get('/product/:productId', reviewController.getProductReviews);

// Endpointy wymagające autoryzacji
router.use(authController.protect);

// Endpointy użytkownika
router.post('/', 
    reviewController.uploadReviewImages,
    reviewController.createReview
);
router.get('/my-reviews', reviewController.getUserReviews);
router.get('/to-review', reviewController.getProductsToReview);
router.patch('/:reviewId', reviewController.updateReview);
router.delete('/:reviewId', reviewController.deleteReview);
router.patch('/:reviewId/helpful', reviewController.markReviewHelpful);

// Endpointy administratora
router.use(authController.restrictTo('admin'));
router.get('/pending', reviewController.getPendingReviews);
router.patch('/:reviewId/moderate', reviewController.moderateReview);

module.exports = router;