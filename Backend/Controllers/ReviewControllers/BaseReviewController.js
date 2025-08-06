const asyncErrorHandler = require('../../Utils/asyncErrorHandler');
const CustomError = require('../../Utils/CustomError');

class BaseReviewController {
    constructor(reviewService) {
        this.reviewService = reviewService;
    }

    createReview = asyncErrorHandler(async (req, res, next) => {
        try {
            const { productId, orderId, rating, title, comment, pros, cons } = req.body;
            const userId = req.user.id;

            // Pobierz ścieżki do zdjęć jeśli zostały przesłane
            const images = req.files ? req.files.map(file => file.filename || file.path) : [];

            const review = await this.reviewService.createReview(userId, {
                productId,
                orderId,
                rating: parseInt(rating),
                title,
                comment,
                pros: pros ? (Array.isArray(pros) ? pros : [pros]) : [],
                cons: cons ? (Array.isArray(cons) ? cons : [cons]) : [],
                images
            });

            res.status(201).json({
                status: 'success',
                message: 'Opinia została dodana pomyślnie',
                data: {
                    review
                }
            });
        } catch (error) {
            const customError = new CustomError(error.message, 400);
            return next(customError);
        }
    });

    getProductReviews = asyncErrorHandler(async (req, res, next) => {
        try {
            const { productId } = req.params;
            const { page = 1, limit = 10, sort = '-createdAt' } = req.query;

            const result = await this.reviewService.getProductReviews(productId, {
                page: parseInt(page),
                limit: parseInt(limit),
                sort
            });

            res.status(200).json({
                status: 'success',
                results: result.reviews.length,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(result.total / limit),
                    totalReviews: result.total,
                    hasNextPage: page < Math.ceil(result.total / limit),
                    hasPrevPage: page > 1
                },
                data: {
                    reviews: result.reviews,
                    stats: result.stats
                }
            });
        } catch (error) {
            const customError = new CustomError(error.message, 404);
            return next(customError);
        }
    });

    getUserReviews = asyncErrorHandler(async (req, res, next) => {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 10 } = req.query;

            const result = await this.reviewService.getUserReviews(userId, {
                page: parseInt(page),
                limit: parseInt(limit)
            });

            res.status(200).json({
                status: 'success',
                results: result.reviews.length,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(result.total / limit),
                    totalReviews: result.total
                },
                data: {
                    reviews: result.reviews
                }
            });
        } catch (error) {
            const customError = new CustomError(error.message, 500);
            return next(customError);
        }
    });

    updateReview = asyncErrorHandler(async (req, res, next) => {
        try {
            const { reviewId } = req.params;
            const userId = req.user.id;
            const { rating, title, comment, pros, cons } = req.body;

            const updateData = {};
            if (rating !== undefined) updateData.rating = parseInt(rating);
            if (title !== undefined) updateData.title = title;
            if (comment !== undefined) updateData.comment = comment;
            if (pros !== undefined) updateData.pros = Array.isArray(pros) ? pros : [pros];
            if (cons !== undefined) updateData.cons = Array.isArray(cons) ? cons : [cons];

            const review = await this.reviewService.updateReview(userId, reviewId, updateData);

            res.status(200).json({
                status: 'success',
                message: 'Opinia została zaktualizowana',
                data: {
                    review
                }
            });
        } catch (error) {
            const customError = new CustomError(error.message, 400);
            return next(customError);
        }
    });

    deleteReview = asyncErrorHandler(async (req, res, next) => {
        try {
            const { reviewId } = req.params;
            const userId = req.user.id;

            await this.reviewService.deleteReview(userId, reviewId);

            res.status(204).json({
                status: 'success',
                message: 'Opinia została usunięta'
            });
        } catch (error) {
            const customError = new CustomError(error.message, 404);
            return next(customError);
        }
    });

    markReviewHelpful = asyncErrorHandler(async (req, res, next) => {
        try {
            const { reviewId } = req.params;

            const review = await this.reviewService.markReviewHelpful(reviewId);

            res.status(200).json({
                status: 'success',
                message: 'Dziękujemy za ocenę przydatności',
                data: {
                    helpfulVotes: review.helpfulVotes || review.helpful_votes
                }
            });
        } catch (error) {
            const customError = new CustomError(error.message, 404);
            return next(customError);
        }
    });

    getProductsToReview = asyncErrorHandler(async (req, res, next) => {
        try {
            const userId = req.user.id;

            const productsToReview = await this.reviewService.getProductsToReview(userId);

            res.status(200).json({
                status: 'success',
                results: productsToReview.length,
                data: {
                    productsToReview
                }
            });
        } catch (error) {
            const customError = new CustomError(error.message, 500);
            return next(customError);
        }
    });

    moderateReview = asyncErrorHandler(async (req, res, next) => {
        try {
            const { reviewId } = req.params;
            const { status, moderatorNote } = req.body;

            const review = await this.reviewService.moderateReview(reviewId, {
                status,
                moderatorNote
            });

            res.status(200).json({
                status: 'success',
                message: `Opinia została ${status === 'approved' ? 'zaakceptowana' : 'odrzucona'}`,
                data: {
                    review
                }
            });
        } catch (error) {
            const customError = new CustomError(error.message, 400);
            return next(customError);
        }
    });

    getPendingReviews = asyncErrorHandler(async (req, res, next) => {
        try {
            const { page = 1, limit = 20 } = req.query;

            const result = await this.reviewService.getPendingReviews({
                page: parseInt(page),
                limit: parseInt(limit)
            });

            res.status(200).json({
                status: 'success',
                results: result.reviews.length,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(result.total / limit),
                    totalReviews: result.total
                },
                data: {
                    reviews: result.reviews
                }
            });
        } catch (error) {
            const customError = new CustomError(error.message, 500);
            return next(customError);
        }
    });
}

module.exports = BaseReviewController;