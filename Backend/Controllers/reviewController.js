const Review = require('../Models/Review');
const Order = require('../Models/Order');
const Product = require('../Models/Product');
const asyncErrorHandler = require('../Utils/asyncErrorHandler');
const CustomError = require('../Utils/CustomError');
const multer = require('multer');
const path = require('path');

// Konfiguracja multer dla zdjęć opinii
const reviewStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/reviews/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'review-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const reviewUpload = multer({
    storage: reviewStorage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 5 // Maksymalnie 5 zdjęć
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new CustomError('Dozwolone są tylko pliki obrazków', 400), false);
        }
    }
});

// Dodaj opinię o produkcie
exports.uploadReviewImages = reviewUpload.array('images', 5);

exports.createReview = asyncErrorHandler(async (req, res, next) => {
    const { productId, orderId, rating, title, comment, pros, cons } = req.body;
    const userId = req.user._id;

    // Sprawdź czy użytkownik kupił ten produkt
    const order = await Order.findOne({
        _id: orderId,
        user: userId,
        status: 'delivered',
        'items.product': productId
    });

    if (!order) {
        const error = new CustomError('Możesz oceniać tylko produkty, które kupiłeś i które zostały dostarczone', 400);
        return next(error);
    }

    // Sprawdź czy użytkownik już nie ocenił tego produktu
    const existingReview = await Review.findOne({
        user: userId,
        product: productId
    });

    if (existingReview) {
        const error = new CustomError('Już oceniłeś ten produkt', 400);
        return next(error);
    }

    // Sprawdź czy produkt istnieje
    const product = await Product.findById(productId);
    if (!product) {
        const error = new CustomError('Produkt nie istnieje', 404);
        return next(error);
    }

    // Utwórz opinię
    const reviewData = {
        user: userId,
        product: productId,
        order: orderId,
        rating,
        title,
        comment,
        verifiedPurchase: true
    };

    if (pros && pros.length > 0) {
        reviewData.pros = pros.filter(pro => pro.trim().length > 0);
    }

    if (cons && cons.length > 0) {
        reviewData.cons = cons.filter(con => con.trim().length > 0);
    }

    // Dodaj zdjęcia jeśli zostały przesłane
    if (req.files && req.files.length > 0) {
        reviewData.images = req.files.map(file => file.filename);
    }

    const review = await Review.create(reviewData);

    res.status(201).json({
        status: 'success',
        message: 'Opinia została dodana pomyślnie',
        data: {
            review
        }
    });
});

// Pobierz opinie produktu
exports.getProductReviews = asyncErrorHandler(async (req, res, next) => {
    const { productId } = req.params;
    const { page = 1, limit = 10, sort = '-createdAt' } = req.query;

    const product = await Product.findById(productId);
    if (!product) {
        const error = new CustomError('Produkt nie istnieje', 404);
        return next(error);
    }

    const reviews = await Review.find({ 
        product: productId, 
        status: 'approved' 
    })
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const total = await Review.countDocuments({ 
        product: productId, 
        status: 'approved' 
    });

    // Statystyki ocen
    const ratingStats = await Review.aggregate([
        { $match: { product: product._id, status: 'approved' } },
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

    let stats = null;
    if (ratingStats.length > 0) {
        const distribution = [0, 0, 0, 0, 0];
        ratingStats[0].ratingCounts.forEach(rating => {
            distribution[rating - 1]++;
        });

        stats = {
            averageRating: Math.round(ratingStats[0].averageRating * 10) / 10,
            totalReviews: ratingStats[0].totalReviews,
            distribution: distribution.map((count, index) => ({
                stars: index + 1,
                count,
                percentage: Math.round((count / ratingStats[0].totalReviews) * 100)
            }))
        };
    }

    res.status(200).json({
        status: 'success',
        results: reviews.length,
        pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalReviews: total,
            hasNextPage: page < Math.ceil(total / limit),
            hasPrevPage: page > 1
        },
        data: {
            reviews,
            stats
        }
    });
});

// Pobierz opinie użytkownika
exports.getUserReviews = asyncErrorHandler(async (req, res, next) => {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    const reviews = await Review.find({ user: userId })
        .populate('product', 'name images price')
        .sort('-createdAt')
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const total = await Review.countDocuments({ user: userId });

    res.status(200).json({
        status: 'success',
        results: reviews.length,
        pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalReviews: total
        },
        data: {
            reviews
        }
    });
});

// Aktualizuj opinię
exports.updateReview = asyncErrorHandler(async (req, res, next) => {
    const { reviewId } = req.params;
    const userId = req.user._id;
    const { rating, title, comment, pros, cons } = req.body;

    const review = await Review.findOne({
        _id: reviewId,
        user: userId
    });

    if (!review) {
        const error = new CustomError('Opinia nie istnieje lub nie masz uprawnień do jej edycji', 404);
        return next(error);
    }

    // Aktualizuj tylko podane pola
    if (rating !== undefined) review.rating = rating;
    if (title !== undefined) review.title = title;
    if (comment !== undefined) review.comment = comment;
    if (pros !== undefined) review.pros = pros.filter(pro => pro.trim().length > 0);
    if (cons !== undefined) review.cons = cons.filter(con => con.trim().length > 0);

    review.updatedAt = Date.now();
    review.status = 'pending'; // Ponowna moderacja po edycji

    await review.save();

    res.status(200).json({
        status: 'success',
        message: 'Opinia została zaktualizowana',
        data: {
            review
        }
    });
});

// Usuń opinię
exports.deleteReview = asyncErrorHandler(async (req, res, next) => {
    const { reviewId } = req.params;
    const userId = req.user._id;

    const review = await Review.findOne({
        _id: reviewId,
        user: userId
    });

    if (!review) {
        const error = new CustomError('Opinia nie istnieje lub nie masz uprawnień do jej usunięcia', 404);
        return next(error);
    }

    await Review.findByIdAndDelete(reviewId);

    res.status(204).json({
        status: 'success',
        message: 'Opinia została usunięta'
    });
});

// Oceń przydatność opinii
exports.markReviewHelpful = asyncErrorHandler(async (req, res, next) => {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
        const error = new CustomError('Opinia nie istnieje', 404);
        return next(error);
    }

    review.helpfulVotes += 1;
    await review.save();

    res.status(200).json({
        status: 'success',
        message: 'Dziękujemy za ocenę przydatności',
        data: {
            helpfulVotes: review.helpfulVotes
        }
    });
});

// Pobierz produkty do oceny (zakupione, ale jeszcze nie ocenione)
exports.getProductsToReview = asyncErrorHandler(async (req, res, next) => {
    const userId = req.user._id;

    // Znajdź dostarczone zamówienia użytkownika
    const deliveredOrders = await Order.find({
        user: userId,
        status: 'delivered'
    }).populate('items.product', 'name images price');

    // Znajdź już ocenione produkty
    const reviewedProducts = await Review.find({
        user: userId
    }).distinct('product');

    // Filtruj produkty do oceny
    const productsToReview = [];
    
    deliveredOrders.forEach(order => {
        order.items.forEach(item => {
            const productId = item.product._id.toString();
            const isAlreadyReviewed = reviewedProducts.some(id => id.toString() === productId);
            
            if (!isAlreadyReviewed) {
                productsToReview.push({
                    orderId: order._id,
                    orderNumber: order.orderNumber,
                    orderDate: order.createdAt,
                    product: item.product,
                    quantity: item.quantity,
                    price: item.price
                });
            }
        });
    });

    res.status(200).json({
        status: 'success',
        results: productsToReview.length,
        data: {
            productsToReview
        }
    });
});

// ADMIN - Moderacja opinii
exports.moderateReview = asyncErrorHandler(async (req, res, next) => {
    const { reviewId } = req.params;
    const { status, moderatorNote } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
        const error = new CustomError('Status musi być "approved" lub "rejected"', 400);
        return next(error);
    }

    const review = await Review.findByIdAndUpdate(
        reviewId,
        { 
            status, 
            moderatorNote: moderatorNote || '',
            updatedAt: Date.now()
        },
        { new: true, runValidators: true }
    );

    if (!review) {
        const error = new CustomError('Opinia nie istnieje', 404);
        return next(error);
    }

    res.status(200).json({
        status: 'success',
        message: `Opinia została ${status === 'approved' ? 'zaakceptowana' : 'odrzucona'}`,
        data: {
            review
        }
    });
});

// ADMIN - Pobierz opinie do moderacji
exports.getPendingReviews = asyncErrorHandler(async (req, res, next) => {
    const { page = 1, limit = 20 } = req.query;

    const reviews = await Review.find({ status: 'pending' })
        .populate('product', 'name images')
        .sort('-createdAt')
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const total = await Review.countDocuments({ status: 'pending' });

    res.status(200).json({
        status: 'success',
        results: reviews.length,
        pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalReviews: total
        },
        data: {
            reviews
        }
    });
});