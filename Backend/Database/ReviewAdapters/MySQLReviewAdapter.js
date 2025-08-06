const ReviewDatabaseAdapter = require('./ReviewDatabaseAdapter');

class MySQLReviewAdapter extends ReviewDatabaseAdapter {
    constructor(pool) {
        super();
        this.pool = pool;
    }

    async createReview(reviewData) {
        const {
            user, product, order, rating, title, comment, 
            pros, cons, images, verifiedPurchase, status
        } = reviewData;

        const [result] = await this.pool.execute(`
            INSERT INTO reviews (user_id, product_id, order_id, rating, title, comment, pros, cons, images, verified_purchase, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            user, 
            product, 
            order, 
            rating, 
            title, 
            comment, 
            JSON.stringify(pros || []), 
            JSON.stringify(cons || []), 
            JSON.stringify(images || []), 
            verifiedPurchase || true, 
            status || 'pending'
        ]);

        return await this.getReviewById(result.insertId);
    }

    async getReviewById(reviewId) {
        const [reviews] = await this.pool.execute(`
            SELECT r.*, u.name as user_name, p.name as product_name
            FROM reviews r
            LEFT JOIN users u ON r.user_id = u.id
            LEFT JOIN products p ON r.product_id = p.id
            WHERE r.id = ?
        `, [reviewId]);

        if (reviews[0]) {
            const review = reviews[0];
            review.pros = JSON.parse(review.pros || '[]');
            review.cons = JSON.parse(review.cons || '[]');
            review.images = JSON.parse(review.images || '[]');
        }

        return reviews[0] || null;
    }

    async getProductReviews(productId, filters = {}) {
        const { page = 1, limit = 10, sort = 'created_at DESC' } = filters;
        
        const [reviews] = await this.pool.execute(`
            SELECT r.*, u.name as user_name, u.photo as user_photo
            FROM reviews r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.product_id = ? AND r.status = 'approved'
            ORDER BY ${sort}
            LIMIT ? OFFSET ?
        `, [productId, parseInt(limit), (page - 1) * parseInt(limit)]);

        return reviews.map(review => ({
            ...review,
            pros: JSON.parse(review.pros || '[]'),
            cons: JSON.parse(review.cons || '[]'),
            images: JSON.parse(review.images || '[]')
        }));
    }

    async getProductReviewsCount(productId) {
        const [result] = await this.pool.execute(`
            SELECT COUNT(*) as count FROM reviews 
            WHERE product_id = ? AND status = 'approved'
        `, [productId]);
        
        return result[0].count;
    }

    async getUserReviews(userId, filters = {}) {
        const { page = 1, limit = 10 } = filters;
        
        const [reviews] = await this.pool.execute(`
            SELECT r.*, p.name as product_name, p.images as product_images, p.price as product_price
            FROM reviews r
            LEFT JOIN products p ON r.product_id = p.id
            WHERE r.user_id = ?
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        `, [userId, parseInt(limit), (page - 1) * parseInt(limit)]);

        return reviews.map(review => ({
            ...review,
            pros: JSON.parse(review.pros || '[]'),
            cons: JSON.parse(review.cons || '[]'),
            images: JSON.parse(review.images || '[]'),
            product: {
                id: review.product_id,
                name: review.product_name,
                images: review.product_images ? review.product_images.split(',') : [],
                price: review.product_price
            }
        }));
    }

    async getUserReviewsCount(userId) {
        const [result] = await this.pool.execute(`
            SELECT COUNT(*) as count FROM reviews WHERE user_id = ?
        `, [userId]);
        
        return result[0].count;
    }

    async updateReview(reviewId, updateData) {
        const fields = [];
        const values = [];

        if (updateData.rating !== undefined) {
            fields.push('rating = ?');
            values.push(updateData.rating);
        }

        if (updateData.title !== undefined) {
            fields.push('title = ?');
            values.push(updateData.title);
        }

        if (updateData.comment !== undefined) {
            fields.push('comment = ?');
            values.push(updateData.comment);
        }

        if (updateData.pros !== undefined) {
            fields.push('pros = ?');
            values.push(JSON.stringify(updateData.pros));
        }

        if (updateData.cons !== undefined) {
            fields.push('cons = ?');
            values.push(JSON.stringify(updateData.cons));
        }

        if (updateData.status !== undefined) {
            fields.push('status = ?');
            values.push(updateData.status);
        }

        if (updateData.moderatorNote !== undefined) {
            fields.push('moderator_note = ?');
            values.push(updateData.moderatorNote);
        }

        if (fields.length === 0) {
            return await this.getReviewById(reviewId);
        }

        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(reviewId);

        await this.pool.execute(`
            UPDATE reviews SET ${fields.join(', ')} WHERE id = ?
        `, values);

        return await this.getReviewById(reviewId);
    }

    async deleteReview(reviewId) {
        const review = await this.getReviewById(reviewId);
        
        if (review) {
            await this.pool.execute('DELETE FROM reviews WHERE id = ?', [reviewId]);
        }
        
        return review;
    }

    async getReviewByUserAndProduct(userId, productId) {
        const [reviews] = await this.pool.execute(`
            SELECT * FROM reviews WHERE user_id = ? AND product_id = ?
        `, [userId, productId]);

        if (reviews[0]) {
            const review = reviews[0];
            review.pros = JSON.parse(review.pros || '[]');
            review.cons = JSON.parse(review.cons || '[]');
            review.images = JSON.parse(review.images || '[]');
        }

        return reviews[0] || null;
    }

    async getOrderByUserAndProduct(userId, orderId, productId) {
        const [orders] = await this.pool.execute(`
            SELECT o.* FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.id = ? AND o.user_id = ? AND o.status = 'delivered' AND oi.product_id = ?
        `, [orderId, userId, productId]);

        return orders[0] || null;
    }

    async getProductById(productId) {
        const [products] = await this.pool.execute(`
            SELECT * FROM products WHERE id = ?
        `, [productId]);

        if (products[0]) {
            const product = products[0];
            product.descriptions = product.descriptions ? product.descriptions.split(',') : [];
            product.images = product.images ? product.images.split(',') : [];
        }

        return products[0] || null;
    }

    async getProductsToReview(userId) {
        const [orders] = await this.pool.execute(`
            SELECT o.id as order_id, o.order_number, o.created_at as order_date,
                   oi.product_id, oi.quantity, oi.price,
                   p.name as product_name, p.images as product_images, p.price as product_price
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN products p ON oi.product_id = p.id
            WHERE o.user_id = ? AND o.status = 'delivered'
            ORDER BY o.created_at DESC
        `, [userId]);

        return orders.map(order => ({
            order_id: order.order_id,
            order_number: order.order_number,
            order_date: order.order_date,
            product: {
                id: order.product_id,
                name: order.product_name,
                images: order.product_images ? order.product_images.split(',') : [],
                price: order.product_price
            },
            quantity: order.quantity,
            price: order.price
        }));
    }

    async getReviewedProducts(userId) {
        const [products] = await this.pool.execute(`
            SELECT DISTINCT product_id FROM reviews WHERE user_id = ?
        `, [userId]);

        return products.map(p => p.product_id);
    }

    async updateReviewHelpfulVotes(reviewId) {
        await this.pool.execute(`
            UPDATE reviews SET helpful_votes = helpful_votes + 1 WHERE id = ?
        `, [reviewId]);

        return await this.getReviewById(reviewId);
    }

    async getPendingReviews(filters = {}) {
        const { page = 1, limit = 20 } = filters;
        
        const [reviews] = await this.pool.execute(`
            SELECT r.*, p.name as product_name, p.images as product_images
            FROM reviews r
            LEFT JOIN products p ON r.product_id = p.id
            WHERE r.status = 'pending'
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        `, [parseInt(limit), (page - 1) * parseInt(limit)]);

        return reviews.map(review => ({
            ...review,
            pros: JSON.parse(review.pros || '[]'),
            cons: JSON.parse(review.cons || '[]'),
            images: JSON.parse(review.images || '[]'),
            product: {
                id: review.product_id,
                name: review.product_name,
                images: review.product_images ? review.product_images.split(',') : []
            }
        }));
    }

    async getPendingReviewsCount() {
        const [result] = await this.pool.execute(`
            SELECT COUNT(*) as count FROM reviews WHERE status = 'pending'
        `);
        
        return result[0].count;
    }

    async getReviewStats(productId) {
        const [stats] = await this.pool.execute(`
            SELECT 
                AVG(rating) as averageRating,
                COUNT(*) as totalReviews,
                GROUP_CONCAT(rating) as ratingCounts
            FROM reviews 
            WHERE product_id = ? AND status = 'approved'
        `, [productId]);

        if (stats[0] && stats[0].totalReviews > 0) {
            const ratingCounts = stats[0].ratingCounts 
                ? stats[0].ratingCounts.split(',').map(Number)
                : [];
            
            return {
                averageRating: parseFloat(stats[0].averageRating),
                totalReviews: stats[0].totalReviews,
                ratingCounts
            };
        }

        return null;
    }
}

module.exports = MySQLReviewAdapter;