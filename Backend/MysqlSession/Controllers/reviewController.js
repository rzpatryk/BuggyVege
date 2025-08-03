const pool = require('../../database');
const asyncErrorHandler = require('../../Utils/asyncErrorHandler');
const CustomError = require('../../Utils/CustomError');
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

// Helper function to update product rating
const updateProductRating = async (connection, productId) => {
    const [ratingResult] = await connection.execute(`
        SELECT AVG(rating) as avgRating, COUNT(*) as reviewCount
        FROM reviews 
        WHERE product_id = ? AND status = 'approved'
    `, [productId]);

    const avgRating = ratingResult[0].avgRating || 0;
    const reviewCount = ratingResult[0].reviewCount || 0;

    await connection.execute(`
        UPDATE products 
        SET average_rating = ?, reviews_count = ? 
        WHERE id = ?
    `, [avgRating, reviewCount, productId]);
};

// Dodaj opinię o produkcie
exports.uploadReviewImages = reviewUpload.array('images', 5);

exports.createReview = asyncErrorHandler(async (req, res, next) => {
    // Sprawdź czy użytkownik jest zalogowany
    if (!req.session.user || !req.session.user.id) {
        const error = new CustomError('Musisz być zalogowany, aby dodać opinię', 401);
        return next(error);
    }

    const { productId, orderId, rating, title, comment, pros, cons } = req.body;
    const userId = req.session.user.id;

    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

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

        // Sprawdź czy produkt istnieje
        const [product] = await connection.execute(`
            SELECT id FROM products WHERE id = ?
        `, [productId]);

        if (product.length === 0) {
            const error = new CustomError('Produkt nie istnieje', 404);
            return next(error);
        }

        // Utwórz opinię
        const [reviewResult] = await connection.execute(`
            INSERT INTO reviews (user_id, product_id, order_id, rating, title, comment, verified_purchase, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [userId, productId, orderId, rating, title, comment, true, 'pending']);

        const reviewId = reviewResult.insertId;

        // Dodaj pros
        if (pros && pros.length > 0) {
            for (const pro of pros) {
                if (pro.trim().length > 0) {
                    await connection.execute(`
                        INSERT INTO review_pros (review_id, pro_text) VALUES (?, ?)
                    `, [reviewId, pro.trim()]);
                }
            }
        }

        // Dodaj cons
        if (cons && cons.length > 0) {
            for (const con of cons) {
                if (con.trim().length > 0) {
                    await connection.execute(`
                        INSERT INTO review_cons (review_id, con_text) VALUES (?, ?)
                    `, [reviewId, con.trim()]);
                }
            }
        }

        // Dodaj zdjęcia jeśli zostały przesłane
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                await connection.execute(`
                    INSERT INTO review_images (review_id, image_path) VALUES (?, ?)
                `, [reviewId, file.filename]);
            }
        }

        await connection.commit();

        res.status(201).json({
            status: 'success',
            message: 'Opinia została dodana pomyślnie',
            data: {
                reviewId
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
    const { page = 1, limit = 10, sort = 'created_at DESC' } = req.query;
    const offset = (page - 1) * limit;

    // Sprawdź czy produkt istnieje
    const [product] = await pool.execute(`
        SELECT id FROM products WHERE id = ?
    `, [productId]);

    if (product.length === 0) {
        const error = new CustomError('Produkt nie istnieje', 404);
        return next(error);
    }

    // Pobierz opinie
    const [reviews] = await pool.execute(`
        SELECT 
            r.*,
            u.name as user_name,
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
        ORDER BY ${sort.replace('-', '') === 'createdAt' ? 'r.created_at DESC' : sort}
        LIMIT ? OFFSET ?
    `, [productId, parseInt(limit), offset]);

    // Pobierz liczbę wszystkich opinii
    const [countResult] = await pool.execute(`
        SELECT COUNT(*) as total FROM reviews 
        WHERE product_id = ? AND status = 'approved'
    `, [productId]);

    // Pobierz statystyki ocen
    const [ratingStats] = await pool.execute(`
        SELECT 
            AVG(rating) as averageRating,
            COUNT(*) as totalReviews,
            SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as rating1,
            SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as rating2,
            SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as rating3,
            SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as rating4,
            SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as rating5
        FROM reviews 
        WHERE product_id = ? AND status = 'approved'
    `, [productId]);

    // Formatuj opinie
    const formattedReviews = reviews.map(review => ({
        ...review,
        pros: review.pros ? review.pros.split('|||') : [],
        cons: review.cons ? review.cons.split('|||') : [],
        images: review.images ? review.images.split(',') : []
    }));

    // Formatuj statystyki
    let stats = null;
    if (ratingStats[0].totalReviews > 0) {
        const totalReviews = ratingStats[0].totalReviews;
        stats = {
            averageRating: Math.round(ratingStats[0].averageRating * 10) / 10,
            totalReviews,
            distribution: [
                { stars: 1, count: ratingStats[0].rating1, percentage: Math.round((ratingStats[0].rating1 / totalReviews) * 100) },
                { stars: 2, count: ratingStats[0].rating2, percentage: Math.round((ratingStats[0].rating2 / totalReviews) * 100) },
                { stars: 3, count: ratingStats[0].rating3, percentage: Math.round((ratingStats[0].rating3 / totalReviews) * 100) },
                { stars: 4, count: ratingStats[0].rating4, percentage: Math.round((ratingStats[0].rating4 / totalReviews) * 100) },
                { stars: 5, count: ratingStats[0].rating5, percentage: Math.round((ratingStats[0].rating5 / totalReviews) * 100) }
            ]
        };
    }

    const total = countResult[0].total;

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
            reviews: formattedReviews,
            stats
        }
    });
});

// Pobierz opinie użytkownika
exports.getUserReviews = asyncErrorHandler(async (req, res, next) => {
    // Sprawdź czy użytkownik jest zalogowany
    if (!req.session.user || !req.session.user.id) {
        const error = new CustomError('Musisz być zalogowany, aby zobaczyć swoje opinie', 401);
        return next(error);
    }

    const userId = req.session.user.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const [reviews] = await pool.execute(`
        SELECT 
            r.*,
            p.name as product_name,
            p.price as product_price,
            GROUP_CONCAT(DISTINCT pi.image_path SEPARATOR ',') as product_images,
            GROUP_CONCAT(DISTINCT rp.pro_text SEPARATOR '|||') as pros,
            GROUP_CONCAT(DISTINCT rc.con_text SEPARATOR '|||') as cons,
            GROUP_CONCAT(DISTINCT ri.image_path SEPARATOR ',') as images
        FROM reviews r
        JOIN products p ON r.product_id = p.id
        LEFT JOIN product_images pi ON p.id = pi.product_id
        LEFT JOIN review_pros rp ON r.id = rp.review_id
        LEFT JOIN review_cons rc ON r.id = rc.review_id
        LEFT JOIN review_images ri ON r.id = ri.review_id
        WHERE r.user_id = ?
        GROUP BY r.id
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
    `, [userId, parseInt(limit), offset]);

    const [countResult] = await pool.execute(`
        SELECT COUNT(*) as total FROM reviews WHERE user_id = ?
    `, [userId]);

    const formattedReviews = reviews.map(review => ({
        ...review,
        product: {
            name: review.product_name,
            price: review.product_price,
            images: review.product_images ? review.product_images.split(',') : []
        },
        pros: review.pros ? review.pros.split('|||') : [],
        cons: review.cons ? review.cons.split('|||') : [],
        images: review.images ? review.images.split(',') : []
    }));

    res.status(200).json({
        status: 'success',
        results: reviews.length,
        pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(countResult[0].total / limit),
            totalReviews: countResult[0].total
        },
        data: {
            reviews: formattedReviews
        }
    });
});

// Aktualizuj opinię
exports.updateReview = asyncErrorHandler(async (req, res, next) => {
    // Sprawdź czy użytkownik jest zalogowany
    if (!req.session.user || !req.session.user.id) {
        const error = new CustomError('Musisz być zalogowany, aby edytować opinię', 401);
        return next(error);
    }

    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { reviewId } = req.params;
        const { rating, title, comment, pros, cons } = req.body;
        const userId = req.session.user.id;

        // Sprawdź czy opinia istnieje i należy do użytkownika
        const [existingReview] = await connection.execute(`
            SELECT id, product_id FROM reviews WHERE id = ? AND user_id = ?
        `, [reviewId, userId]);

        if (existingReview.length === 0) {
            const error = new CustomError('Opinia nie istnieje lub nie masz uprawnień do jej edycji', 404);
            return next(error);
        }

        // Aktualizuj opinię
        await connection.execute(`
            UPDATE reviews 
            SET rating = ?, title = ?, comment = ?, status = 'pending', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [rating, title, comment, reviewId]);

        // Aktualizuj pros
        if (pros !== undefined) {
            await connection.execute('DELETE FROM review_pros WHERE review_id = ?', [reviewId]);
            for (const pro of pros) {
                if (pro.trim().length > 0) {
                    await connection.execute(`
                        INSERT INTO review_pros (review_id, pro_text) VALUES (?, ?)
                    `, [reviewId, pro.trim()]);
                }
            }
        }

        // Aktualizuj cons
        if (cons !== undefined) {
            await connection.execute('DELETE FROM review_cons WHERE review_id = ?', [reviewId]);
            for (const con of cons) {
                if (con.trim().length > 0) {
                    await connection.execute(`
                        INSERT INTO review_cons (review_id, con_text) VALUES (?, ?)
                    `, [reviewId, con.trim()]);
                }
            }
        }

        // Aktualizuj ocenę produktu
        await updateProductRating(connection, existingReview[0].product_id);

        await connection.commit();

        res.status(200).json({
            status: 'success',
            message: 'Opinia została zaktualizowana'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Błąd aktualizacji opinii:', error);
        const customError = new CustomError('Błąd podczas aktualizacji opinii', 500);
        return next(customError);
    } finally {
        connection.release();
    }
});

// Usuń opinię
exports.deleteReview = asyncErrorHandler(async (req, res, next) => {
    // Sprawdź czy użytkownik jest zalogowany
    if (!req.session.user || !req.session.user.id) {
        const error = new CustomError('Musisz być zalogowany, aby usunąć opinię', 401);
        return next(error);
    }

    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { reviewId } = req.params;
        const userId = req.session.user.id;

        // Sprawdź czy opinia istnieje i należy do użytkownika
        const [existingReview] = await connection.execute(`
            SELECT id, product_id FROM reviews WHERE id = ? AND user_id = ?
        `, [reviewId, userId]);

        if (existingReview.length === 0) {
            const error = new CustomError('Opinia nie istnieje lub nie masz uprawnień do jej usunięcia', 404);
            return next(error);
        }

        const productId = existingReview[0].product_id;

        // Usuń opinię (kaskadowo usuną się pros, cons, zdjęcia)
        await connection.execute('DELETE FROM reviews WHERE id = ?', [reviewId]);

        // Aktualizuj ocenę produktu
        await updateProductRating(connection, productId);

        await connection.commit();

        res.status(204).json({
            status: 'success',
            message: 'Opinia została usunięta'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Błąd usuwania opinii:', error);
        const customError = new CustomError('Błąd podczas usuwania opinii', 500);
        return next(customError);
    } finally {
        connection.release();
    }
});

// Oceń przydatność opinii
exports.markReviewHelpful = asyncErrorHandler(async (req, res, next) => {
    const { reviewId } = req.params;

    const [result] = await pool.execute(`
        UPDATE reviews SET helpful_votes = helpful_votes + 1 WHERE id = ?
    `, [reviewId]);

    if (result.affectedRows === 0) {
        const error = new CustomError('Opinia nie istnieje', 404);
        return next(error);
    }

    const [updatedReview] = await pool.execute(`
        SELECT helpful_votes FROM reviews WHERE id = ?
    `, [reviewId]);

    res.status(200).json({
        status: 'success',
        message: 'Dziękujemy za ocenę przydatności',
        data: {
            helpfulVotes: updatedReview[0].helpful_votes
        }
    });
});

// Pobierz produkty do oceny (zakupione, ale jeszcze nie ocenione)
exports.getProductsToReview = asyncErrorHandler(async (req, res, next) => {
    // Sprawdź czy użytkownik jest zalogowany
    if (!req.session.user || !req.session.user.id) {
        const error = new CustomError('Musisz być zalogowany, aby zobaczyć produkty do oceny', 401);
        return next(error);
    }

    const userId = req.session.user.id;

    const [productsToReview] = await pool.execute(`
        SELECT DISTINCT
            o.id as order_id,
            o.order_number,
            o.created_at as order_date,
            oi.product_id,
            oi.quantity,
            oi.price,
            p.name as product_name,
            p.price as product_price,
            GROUP_CONCAT(DISTINCT pi.image_path SEPARATOR ',') as images
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        JOIN products p ON oi.product_id = p.id
        LEFT JOIN product_images pi ON p.id = pi.product_id
        WHERE o.user_id = ? 
        AND o.status = 'delivered'
        AND NOT EXISTS (
            SELECT 1 FROM reviews r 
            WHERE r.user_id = ? AND r.product_id = oi.product_id
        )
        GROUP BY o.id, oi.product_id
        ORDER BY o.created_at DESC
    `, [userId, userId]);

    const formattedProducts = productsToReview.map(item => ({
        orderId: item.order_id,
        orderNumber: item.order_number,
        orderDate: item.order_date,
        product: {
            id: item.product_id,
            name: item.product_name,
            price: item.product_price,
            images: item.images ? item.images.split(',') : []
        },
        quantity: item.quantity,
        price: item.price
    }));

    res.status(200).json({
        status: 'success',
        results: formattedProducts.length,
        data: {
            productsToReview: formattedProducts
        }
    });
});

// ADMIN - Moderacja opinii
exports.moderateReview = asyncErrorHandler(async (req, res, next) => {
    // Sprawdź czy użytkownik jest zalogowany i jest administratorem
    if (!req.session.user || !req.session.user.id) {
        const error = new CustomError('Musisz być zalogowany, aby moderować opinie', 401);
        return next(error);
    }

    if (!req.session.user.isAdmin) {
        const error = new CustomError('Brak uprawnień administratora', 403);
        return next(error);
    }

    const { reviewId } = req.params;
    const { status, moderatorNote } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
        const error = new CustomError('Status musi być "approved" lub "rejected"', 400);
        return next(error);
    }

    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const [result] = await connection.execute(`
            UPDATE reviews 
            SET status = ?, moderator_note = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [status, moderatorNote || '', reviewId]);

        if (result.affectedRows === 0) {
            const error = new CustomError('Opinia nie istnieje', 404);
            return next(error);
        }

        // Pobierz ID produktu aby zaktualizować ocenę
        const [review] = await connection.execute(`
            SELECT product_id FROM reviews WHERE id = ?
        `, [reviewId]);

        if (review.length > 0) {
            await updateProductRating(connection, review[0].product_id);
        }

        await connection.commit();

        res.status(200).json({
            status: 'success',
            message: `Opinia została ${status === 'approved' ? 'zaakceptowana' : 'odrzucona'}`
        });

    } catch (error) {
        await connection.rollback();
        console.error('Błąd moderacji opinii:', error);
        const customError = new CustomError('Błąd podczas moderacji opinii', 500);
        return next(customError);
    } finally {
        connection.release();
    }
});

// ADMIN - Pobierz opinie do moderacji
exports.getPendingReviews = asyncErrorHandler(async (req, res, next) => {
    // Sprawdź czy użytkownik jest zalogowany i jest administratorem
    if (!req.session.user || !req.session.user.id) {
        const error = new CustomError('Musisz być zalogowany, aby zobaczyć opinie do moderacji', 401);
        return next(error);
    }

    if (!req.session.user.isAdmin) {
        const error = new CustomError('Brak uprawnień administratora', 403);
        return next(error);
    }

    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const [reviews] = await pool.execute(`
        SELECT 
            r.*,
            u.name as user_name,
            p.name as product_name,
            GROUP_CONCAT(DISTINCT pi.image_path SEPARATOR ',') as product_images,
            GROUP_CONCAT(DISTINCT rp.pro_text SEPARATOR '|||') as pros,
            GROUP_CONCAT(DISTINCT rc.con_text SEPARATOR '|||') as cons,
            GROUP_CONCAT(DISTINCT ri.image_path SEPARATOR ',') as images
        FROM reviews r
        JOIN users u ON r.user_id = u.id
        JOIN products p ON r.product_id = p.id
        LEFT JOIN product_images pi ON p.id = pi.product_id
        LEFT JOIN review_pros rp ON r.id = rp.review_id
        LEFT JOIN review_cons rc ON r.id = rc.review_id
        LEFT JOIN review_images ri ON r.id = ri.review_id
        WHERE r.status = 'pending'
        GROUP BY r.id
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
    `, [parseInt(limit), offset]);

    const [countResult] = await pool.execute(`
        SELECT COUNT(*) as total FROM reviews WHERE status = 'pending'
    `);

    const formattedReviews = reviews.map(review => ({
        ...review,
        product: {
            name: review.product_name,
            images: review.product_images ? review.product_images.split(',') : []
        },
        pros: review.pros ? review.pros.split('|||') : [],
        cons: review.cons ? review.cons.split('|||') : [],
        images: review.images ? review.images.split(',') : []
    }));

    res.status(200).json({
        status: 'success',
        results: reviews.length,
        pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(countResult[0].total / limit),
            totalReviews: countResult[0].total
        },
        data: {
            reviews: formattedReviews
        }
    });
});