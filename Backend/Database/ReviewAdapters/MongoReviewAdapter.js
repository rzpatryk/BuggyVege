const ReviewDatabaseAdapter = require('./ReviewDatabaseAdapter');
const Review = require('../../Models/Review');
const Order = require('../../Models/Order');
const Product = require('../../Models/Product');

class MongoReviewAdapter extends ReviewDatabaseAdapter {
    async createReview(reviewData) {
        const review = await Review.create(reviewData);
        return review;
    }

    async getReviewById(reviewId) {
        const review = await Review.findById(reviewId);
        return review;
    }

    async getProductReviews(productId, filters = {}) {
        const { page = 1, limit = 10, sort = '-createdAt' } = filters;
        
        const reviews = await Review.find({ 
            product: productId, 
            status: 'approved' 
        })
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit);

        return reviews;
    }

    async getProductReviewsCount(productId) {
        return await Review.countDocuments({ 
            product: productId, 
            status: 'approved' 
        });
    }

    async getUserReviews(userId, filters = {}) {
        const { page = 1, limit = 10 } = filters;
        
        const reviews = await Review.find({ user: userId })
            .populate('product', 'name images price')
            .sort('-createdAt')
            .limit(limit * 1)
            .skip((page - 1) * limit);

        return reviews;
    }

    async getUserReviewsCount(userId) {
        return await Review.countDocuments({ user: userId });
    }

    async updateReview(reviewId, updateData) {
        const review = await Review.findByIdAndUpdate(
            reviewId, 
            updateData, 
            { new: true, runValidators: true }
        );
        return review;
    }

    async deleteReview(reviewId) {
        const review = await Review.findByIdAndDelete(reviewId);
        return review;
    }

    async getReviewByUserAndProduct(userId, productId) {
        const review = await Review.findOne({
            user: userId,
            product: productId
        });
        return review;
    }

    async getOrderByUserAndProduct(userId, orderId, productId) {
        const order = await Order.findOne({
            _id: orderId,
            user: userId,
            status: 'delivered',
            'items.product': productId
        });
        return order;
    }

    async getProductById(productId) {
        const product = await Product.findById(productId);
        return product;
    }

    async getProductsToReview(userId) {
        const deliveredOrders = await Order.find({
            user: userId,
            status: 'delivered'
        }).populate('items.product', 'name images price');

        return deliveredOrders;
    }

    async getReviewedProducts(userId) {
        return await Review.find({ user: userId }).distinct('product');
    }

    async updateReviewHelpfulVotes(reviewId) {
        const review = await Review.findByIdAndUpdate(
            reviewId,
            { $inc: { helpfulVotes: 1 } },
            { new: true }
        );
        return review;
    }

    async getPendingReviews(filters = {}) {
        const { page = 1, limit = 20 } = filters;
        
        const reviews = await Review.find({ status: 'pending' })
            .populate('product', 'name images')
            .sort('-createdAt')
            .limit(limit * 1)
            .skip((page - 1) * limit);

        return reviews;
    }

    async getPendingReviewsCount() {
        return await Review.countDocuments({ status: 'pending' });
    }

    async getReviewStats(productId) {
        const stats = await Review.aggregate([
            { $match: { product: productId, status: 'approved' } },
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: '$rating' },
                    totalReviews: { $sum: 1 },
                    ratingCounts: {
                        $push: '$rating'
                    }
                }
            }
        ]);

        return stats[0] || null;
    }
}

module.exports = MongoReviewAdapter;