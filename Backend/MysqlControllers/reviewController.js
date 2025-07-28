const { pool } = require('../database');
const asyncErrorHandler = require('../Utils/asyncErrorHandler');
const CustomError = require('../Utils/CustomError');
const multer = require('multer');
const path = require('path');

// Konfiguracja multer (bez zmian)
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
        fileSize: 5 * 1024 * 1024,
        files: 5
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new CustomError('Dozwolone są tylko pliki obrazków', 400), false);
        }
    }
});

exports.uploadReviewImages = reviewUpload.array('images', 5);

// Dodaj opinię
exports.createReview = asyncErrorHandler(async (req, res, next) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { productId, orderId, rating, title, comment, pros, cons } = req.body;
        const userId = req.user.id;

        // Sprawdź czy użytkownik kupił ten produkt
        const [orderCheck] = await connection.execute(`
            SELECT o.id 
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.id = ? AND o.user_id = ? AND o.status = 'delivered' AND oi.product_id = ?
        `, [orderId, userId, productId]);

        if (orderCheck.length === 0) {
            const error = new CustomError('Możesz oceniać tylko produkty, które kupiłeś i które zostały dostarczone', 400);
            return next(error);
        }

        // Sprawdź czy użytkownik już nie ocenił tego produktu
        const [existingReview] = await connection.execute(`
            SELECT id FROM reviews WHERE user_id = ? AND product_id = ?
        `, [userId, productId]);

        if (existingReview.length > 0) {
            const error = new CustomError('Już oceniłeś ten produkt', 400);
            return next(error);
        }

        // Dodaj opinię
        const [result] = await connection.execute(`
            INSERT INTO reviews (user_id, product_id, order_id, rating, title, comment)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [userId, productId, orderId, rating, title, comment]);

        const reviewId = result.insertId;

        // Dodaj pros
        if (pros && pros.length > 0) {
            for (const pro of pros) {
                if (pro.trim().length > 0) {
                    await connection.execute(`
                        INSERT INTO review_pros (review_id, pro_text)
                        VALUES (?, ?)
                    `, [reviewId, pro.trim()]);
                }
            }
        }

        // Dodaj cons
        if (cons && cons.length > 0) {
            for (const con of cons) {
                if (con.trim().length > 0) {
                    await connection.execute(`
                        INSERT INTO review_cons (review_id, con_text)
                        VALUES (?, ?)
                    `, [reviewId, con.trim()]);
                }
            }
        }

        // Dodaj zdjęcia
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                await connection.execute(`
                    INSERT INTO review_images (review_id, image_path)
                    VALUES (?, ?)
                `, [reviewId, file.filename]);
            }
        }

        // Aktualizuj średnią ocenę produktu
        await updateProductRating(connection, productId);

        await connection.commit();

        res.status(201).json({
            status: 'success',
            message: 'Opinia została dodana pomyślnie',
            data: {
                reviewId: reviewId
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Błąd tworzenia opinii:', error);
        const customError = new CustomError('Błąd podczas dodawania opinii', 500);
        return next(customError);
    } finally {
        connection.release();
    }
});

// Pobierz opinie produktu
exports.getProductReviews = asyncErrorHandler(async (req, res, next) => {
    const { productId } = req.params;
    const { page = 1, limit = 10, sort = 'created_at', order = 'DESC' } = req.query;
    const offset = (page - 1) * limit;

    // Sprawdź czy produkt istnieje
    const [productCheck] = await pool.execute('SELECT id FROM products WHERE id = ?', [productId]);
    if (productCheck.length === 0) {
        const error = new CustomError('Produkt nie istnieje', 404);
        return next(error);
    }

    // Pobierz opinie
    const [reviews] = await pool.execute(`
        SELECT 
            r.*,
            u.name as user_name,
            u.photo as user_photo,
            GROUP_CONCAT(DISTINCT rp.pro_text SEPARATOR '|||') as pros,
            GROUP_CONCAT(DISTINCT rc.con_text SEPARATOR '|||') as cons,
            GROUP_CONCAT(DISTINCT ri.image_path SEPARATOR ',') as images
        FROM reviews r
        JOIN users u ON r.user_id = u.id
        LEFT JOIN review_pros rp ON r.id = rp.review_id
        LEFT JOIN review_cons rc ON r.id = rc.review_id
        LEFT JOIN review_images ri ON r.id = ri.review_id
        WHERE r.product_id = ? AND r.status = 'approved'
        GROUP BY r.id
        ORDER BY r.${sort} ${order}
        LIMIT ? OFFSET ?
    `, [productId, parseInt(limit), offset]);

    // Formatuj dane
    const formattedReviews = reviews.map(review => ({
        ...review,
        pros: review.pros ? review.pros.split('|||') : [],
        cons: review.cons ? review.cons.split('|||') : [],
        images: review.images ? review.images.split(',') : []
    }));

    // Pobierz statystyki
    const [stats] = await pool.execute(`
        SELECT 
            COUNT(*) as total_reviews,
            AVG(rating) as avg_rating,
            SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as rating_1,
            SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as rating_2,
            SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as rating_3,
            SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as rating_4,
            SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as rating_5
        FROM reviews 
        WHERE product_id = ? AND status = 'approved'
    `, [productId]);

    const reviewStats = stats[0].total_reviews > 0 ? {
        averageRating: Math.round(stats[0].avg_rating * 10) / 10,
        totalReviews: stats[0].total_reviews,
        distribution: [
            { stars: 1, count: stats[0].rating_1, percentage: Math.round((stats[0].rating_1 / stats[0].total_reviews) * 100) },
            { stars: 2, count: stats[0].rating_2, percentage: Math.round((stats[0].rating_2 / stats[0].total_reviews) * 100) },
            { stars: 3, count: stats[0].rating_3, percentage: Math.round((stats[0].rating_3 / stats[0].total_reviews) * 100) },
            { stars: 4, count: stats[0].rating_4, percentage: Math.round((stats[0].rating_4 / stats[0].total_reviews) * 100) },
            { stars: 5, count: stats[0].rating_5, percentage: Math.round((stats[0].rating_5 / stats[0].total_reviews) * 100) }
        ]
    } : null;

    res.status(200).json({
        status: 'success',
        results: formattedReviews.length,
        pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(stats[0].total_reviews / limit),
            totalReviews: stats[0].total_reviews
        },
        data: {
            reviews: formattedReviews,
            stats: reviewStats
        }
    });
});

// Funkcja pomocnicza do aktualizacji oceny produktu
async function updateProductRating(connection, productId) {
    const [stats] = await connection.execute(`
        SELECT 
            COUNT(*) as total_reviews,
            AVG(rating) as avg_rating,
            SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as rating_1,
            SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as rating_2,
            SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as rating_3,
            SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as rating_4,
            SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as rating_5
        FROM reviews 
        WHERE product_id = ? AND status = 'approved'
    `, [productId]);

    if (stats.length > 0) {
        const distribution = [
            stats[0].rating_1,
            stats[0].rating_2,
            stats[0].rating_3,
            stats[0].rating_4,
            stats[0].rating_5
        ];

        await connection.execute(`
            UPDATE products 
            SET 
                ratings_quantity = ?,
                ratings_average = ?,
                rating_distribution = ?
            WHERE id = ?
        `, [
            stats[0].total_reviews,
            Math.round(stats[0].avg_rating * 10) / 10,
            JSON.stringify(distribution),
            productId
        ]);
    }
}