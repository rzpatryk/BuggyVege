class ReviewService {
    constructor(dbAdapter) {
        this.db = dbAdapter;
    }

    async createReview(userId, reviewData) {
        const { productId, orderId, rating, title, comment, pros, cons, images } = reviewData;

        // Walidacja
        if (!productId || !orderId || !rating || !title || !comment) {
            throw new Error('ProductId, orderId, rating, title i comment są wymagane');
        }

        if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
            throw new Error('Ocena musi być liczbą całkowitą od 1 do 5');
        }

        if (title.length > 100) {
            throw new Error('Tytuł nie może być dłuższy niż 100 znaków');
        }

        if (comment.length < 10 || comment.length > 1000) {
            throw new Error('Komentarz musi mieć od 10 do 1000 znaków');
        }

        // Sprawdź czy użytkownik kupił ten produkt
        const order = await this.db.getOrderByUserAndProduct(userId, orderId, productId);
        if (!order) {
            throw new Error('Możesz oceniać tylko produkty, które kupiłeś i które zostały dostarczone');
        }

        // Sprawdź czy użytkownik już nie ocenił tego produktu
        const existingReview = await this.db.getReviewByUserAndProduct(userId, productId);
        if (existingReview) {
            throw new Error('Już oceniłeś ten produkt');
        }

        // Sprawdź czy produkt istnieje
        const product = await this.db.getProductById(productId);
        if (!product) {
            throw new Error('Produkt nie istnieje');
        }

        // Przygotuj dane opinii
        const reviewToCreate = {
            user: userId,
            product: productId,
            order: orderId,
            rating,
            title,
            comment,
            verifiedPurchase: true,
            status: 'pending'
        };

        if (pros && Array.isArray(pros)) {
            reviewToCreate.pros = pros.filter(pro => pro.trim().length > 0);
        }

        if (cons && Array.isArray(cons)) {
            reviewToCreate.cons = cons.filter(con => con.trim().length > 0);
        }

        if (images && Array.isArray(images)) {
            reviewToCreate.images = images;
        }

        const review = await this.db.createReview(reviewToCreate);
        return review;
    }

    async getProductReviews(productId, filters = {}) {
        if (!productId) {
            throw new Error('ID produktu jest wymagane');
        }

        const product = await this.db.getProductById(productId);
        if (!product) {
            throw new Error('Produkt nie istnieje');
        }

        const reviews = await this.db.getProductReviews(productId, filters);
        const total = await this.db.getProductReviewsCount(productId);

        // Pobierz statystyki ocen
        const stats = await this.db.getReviewStats(productId);
        let formattedStats = null;

        if (stats) {
            const distribution = [0, 0, 0, 0, 0];
            stats.ratingCounts.forEach(rating => {
                distribution[rating - 1]++;
            });

            formattedStats = {
                averageRating: Math.round(stats.averageRating * 10) / 10,
                totalReviews: stats.totalReviews,
                distribution: distribution.map((count, index) => ({
                    stars: index + 1,
                    count,
                    percentage: Math.round((count / stats.totalReviews) * 100)
                }))
            };
        }

        return {
            reviews,
            total,
            stats: formattedStats
        };
    }

    async getUserReviews(userId, filters = {}) {
        if (!userId) {
            throw new Error('ID użytkownika jest wymagane');
        }

        const reviews = await this.db.getUserReviews(userId, filters);
        const total = await this.db.getUserReviewsCount(userId);

        return {
            reviews,
            total
        };
    }

    async updateReview(userId, reviewId, updateData) {
        if (!userId || !reviewId) {
            throw new Error('ID użytkownika i opinii są wymagane');
        }

        const review = await this.db.getReviewById(reviewId);
        if (!review) {
            throw new Error('Opinia nie istnieje');
        }

        // Sprawdź czy użytkownik jest właścicielem opinii
        const userField = review.user_id || review.user;
        if (userField.toString() !== userId.toString()) {
            throw new Error('Nie masz uprawnień do edycji tej opinii');
        }

        // Walidacja danych
        if (updateData.rating !== undefined) {
            if (updateData.rating < 1 || updateData.rating > 5 || !Number.isInteger(updateData.rating)) {
                throw new Error('Ocena musi być liczbą całkowitą od 1 do 5');
            }
        }

        if (updateData.title !== undefined && updateData.title.length > 100) {
            throw new Error('Tytuł nie może być dłuższy niż 100 znaków');
        }

        if (updateData.comment !== undefined) {
            if (updateData.comment.length < 10 || updateData.comment.length > 1000) {
                throw new Error('Komentarz musi mieć od 10 do 1000 znaków');
            }
        }

        // Przygotuj dane do aktualizacji
        const cleanUpdateData = {};
        
        if (updateData.rating !== undefined) cleanUpdateData.rating = updateData.rating;
        if (updateData.title !== undefined) cleanUpdateData.title = updateData.title;
        if (updateData.comment !== undefined) cleanUpdateData.comment = updateData.comment;
        
        if (updateData.pros !== undefined) {
            cleanUpdateData.pros = Array.isArray(updateData.pros) 
                ? updateData.pros.filter(pro => pro.trim().length > 0)
                : [];
        }
        
        if (updateData.cons !== undefined) {
            cleanUpdateData.cons = Array.isArray(updateData.cons) 
                ? updateData.cons.filter(con => con.trim().length > 0)
                : [];
        }

        // Ustaw status na pending po edycji
        cleanUpdateData.status = 'pending';

        const updatedReview = await this.db.updateReview(reviewId, cleanUpdateData);
        return updatedReview;
    }

    async deleteReview(userId, reviewId) {
        if (!userId || !reviewId) {
            throw new Error('ID użytkownika i opinii są wymagane');
        }

        const review = await this.db.getReviewById(reviewId);
        if (!review) {
            throw new Error('Opinia nie istnieje');
        }

        // Sprawdź czy użytkownik jest właścicielem opinii
        const userField = review.user_id || review.user;
        if (userField.toString() !== userId.toString()) {
            throw new Error('Nie masz uprawnień do usunięcia tej opinii');
        }

        const deletedReview = await this.db.deleteReview(reviewId);
        return deletedReview;
    }

    async markReviewHelpful(reviewId) {
        if (!reviewId) {
            throw new Error('ID opinii jest wymagane');
        }

        const review = await this.db.getReviewById(reviewId);
        if (!review) {
            throw new Error('Opinia nie istnieje');
        }

        const updatedReview = await this.db.updateReviewHelpfulVotes(reviewId);
        return updatedReview;
    }

    async getProductsToReview(userId) {
        if (!userId) {
            throw new Error('ID użytkownika jest wymagane');
        }

        // Pobierz dostarczone zamówienia
        const deliveredOrders = await this.db.getProductsToReview(userId);
        
        // Pobierz już ocenione produkty
        const reviewedProductIds = await this.db.getReviewedProducts(userId);

        // Filtruj produkty do oceny
        const productsToReview = [];
        
        deliveredOrders.forEach(order => {
            const productId = (order.product?.id || order.product_id).toString();
            const isAlreadyReviewed = reviewedProductIds.some(id => id.toString() === productId);
            
            if (!isAlreadyReviewed) {
                productsToReview.push({
                    orderId: order.order_id || order._id,
                    orderNumber: order.order_number || order.orderNumber,
                    orderDate: order.order_date || order.createdAt,
                    product: order.product,
                    quantity: order.quantity,
                    price: order.price
                });
            }
        });

        return productsToReview;
    }

    async moderateReview(reviewId, moderationData) {
        const { status, moderatorNote } = moderationData;

        if (!reviewId) {
            throw new Error('ID opinii jest wymagane');
        }

        if (!['approved', 'rejected'].includes(status)) {
            throw new Error('Status musi być "approved" lub "rejected"');
        }

        const review = await this.db.getReviewById(reviewId);
        if (!review) {
            throw new Error('Opinia nie istnieje');
        }

        const updateData = {
            status,
            moderatorNote: moderatorNote || ''
        };

        const updatedReview = await this.db.updateReview(reviewId, updateData);
        return updatedReview;
    }

    async getPendingReviews(filters = {}) {
        const reviews = await this.db.getPendingReviews(filters);
        const total = await this.db.getPendingReviewsCount();

        return {
            reviews,
            total
        };
    }
}

module.exports = ReviewService;