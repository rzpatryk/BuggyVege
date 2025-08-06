class ReviewDatabaseAdapter {
    async createReview(reviewData) {
        throw new Error('Method must be implemented');
    }

    async getReviewById(reviewId) {
        throw new Error('Method must be implemented');
    }

    async getProductReviews(productId, filters = {}) {
        throw new Error('Method must be implemented');
    }

    async getProductReviewsCount(productId) {
        throw new Error('Method must be implemented');
    }

    async getUserReviews(userId, filters = {}) {
        throw new Error('Method must be implemented');
    }

    async getUserReviewsCount(userId) {
        throw new Error('Method must be implemented');
    }

    async updateReview(reviewId, updateData) {
        throw new Error('Method must be implemented');
    }

    async deleteReview(reviewId) {
        throw new Error('Method must be implemented');
    }

    async getReviewByUserAndProduct(userId, productId) {
        throw new Error('Method must be implemented');
    }

    async getOrderByUserAndProduct(userId, orderId, productId) {
        throw new Error('Method must be implemented');
    }

    async getProductById(productId) {
        throw new Error('Method must be implemented');
    }

    async getProductsToReview(userId) {
        throw new Error('Method must be implemented');
    }

    async getReviewedProducts(userId) {
        throw new Error('Method must be implemented');
    }

    async updateReviewHelpfulVotes(reviewId) {
        throw new Error('Method must be implemented');
    }

    async getPendingReviews(filters = {}) {
        throw new Error('Method must be implemented');
    }

    async getPendingReviewsCount() {
        throw new Error('Method must be implemented');
    }

    async getReviewStats(productId) {
        throw new Error('Method must be implemented');
    }
}

module.exports = ReviewDatabaseAdapter;