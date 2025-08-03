const { pool } = require('../../database');
const asyncErrorHandler = require('../../Utils/asyncErrorHandler');
const CustomError = require('../../Utils/CustomError');

// Middleware do sprawdzania sesji użytkownika
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        const error = new CustomError('Brak autoryzacji. Proszę się zalogować.', 401);
        return next(error);
    }
    next();
};

// Middleware do sprawdzania uprawnień administratora
const requireAdmin = async (req, res, next) => {
    try {
        if (!req.session || !req.session.userId) {
            const error = new CustomError('Brak autoryzacji. Proszę się zalogować.', 401);
            return next(error);
        }

        const [user] = await pool.execute(
            'SELECT role FROM users WHERE id = ?', 
            [req.session.userId]
        );

        if (user.length === 0 || user[0].role !== 'admin') {
            const error = new CustomError('Brak uprawnień administratora.', 403);
            return next(error);
        }

        next();
    } catch (error) {
        const customError = new CustomError('Błąd podczas sprawdzania uprawnień', 500);
        return next(customError);
    }
};

// Dodaj produkt (tylko dla administratorów)
exports.addProduct = [requireAdmin, asyncErrorHandler(async (req, res, next) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { name, descriptions, category, price, offerPrice } = req.body;
        const imagePaths = req.files ? req.files.map(file => file.filename) : [];

        // Dodaj produkt
        const [result] = await connection.execute(`
            INSERT INTO products (name, category, price, offer_price, created_by)
            VALUES (?, ?, ?, ?, ?)
        `, [name, category, parseFloat(price), offerPrice ? parseFloat(offerPrice) : null, req.session.userId]);

        const productId = result.insertId;

        // Dodaj opisy
        if (descriptions) {
            const descArray = descriptions.split(',').map(s => s.trim());
            for (const desc of descArray) {
                await connection.execute(`
                    INSERT INTO product_descriptions (product_id, description)
                    VALUES (?, ?)
                `, [productId, desc]);
            }
        }

        // Dodaj zdjęcia
        for (const imagePath of imagePaths) {
            await connection.execute(`
                INSERT INTO product_images (product_id, image_path)
                VALUES (?, ?)
            `, [productId, imagePath]);
        }

        await connection.commit();

        res.status(201).json({
            status: 'success',
            message: 'Produkt został dodany pomyślnie',
            data: {
                product: {
                    id: productId,
                    name,
                    category,
                    price: parseFloat(price),
                    offerPrice: offerPrice ? parseFloat(offerPrice) : null
                }
            }
        });

    } catch (error) {
        await connection.rollback();
        const customError = new CustomError('Błąd podczas dodawania produktu', 500);
        return next(customError);
    } finally {
        connection.release();
    }
})];

// Pobierz wszystkie produkty (dostępne dla wszystkich)
exports.getAllProducts = asyncErrorHandler(async (req, res, next) => {
    const { page = 1, limit = 10, category, minPrice, maxPrice } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [];

    if (category) {
        whereClause += ' WHERE p.category = ?';
        params.push(category);
    }

    if (minPrice || maxPrice) {
        if (whereClause) {
            whereClause += ' AND ';
        } else {
            whereClause += ' WHERE ';
        }
        
        if (minPrice && maxPrice) {
            whereClause += 'p.price BETWEEN ? AND ?';
            params.push(parseFloat(minPrice), parseFloat(maxPrice));
        } else if (minPrice) {
            whereClause += 'p.price >= ?';
            params.push(parseFloat(minPrice));
        } else if (maxPrice) {
            whereClause += 'p.price <= ?';
            params.push(parseFloat(maxPrice));
        }
    }

    const [products] = await pool.execute(`
        SELECT 
            p.*,
            GROUP_CONCAT(DISTINCT pd.description SEPARATOR '|||') as descriptions,
            GROUP_CONCAT(DISTINCT pi.image_path SEPARATOR ',') as images
        FROM products p
        LEFT JOIN product_descriptions pd ON p.id = pd.product_id
        LEFT JOIN product_images pi ON p.id = pi.product_id
        ${whereClause}
        GROUP BY p.id
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    // Formatuj dane
    const formattedProducts = products.map(product => ({
        ...product,
        descriptions: product.descriptions ? product.descriptions.split('|||') : [],
        images: product.images ? product.images.split(',') : []
    }));

    // Pobierz całkowitą liczbę produktów
    const [countResult] = await pool.execute(`
        SELECT COUNT(DISTINCT p.id) as total 
        FROM products p 
        ${whereClause}
    `, params);

    res.status(200).json({
        status: 'success',
        results: formattedProducts.length,
        pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(countResult[0].total / limit),
            totalProducts: countResult[0].total
        },
        data: {
            products: formattedProducts
        }
    });
});

// Pobierz jeden produkt (dostępne dla wszystkich)
exports.getProduct = asyncErrorHandler(async (req, res, next) => {
    const { id } = req.params;

    const [products] = await pool.execute(`
        SELECT 
            p.*,
            GROUP_CONCAT(DISTINCT pd.description SEPARATOR '|||') as descriptions,
            GROUP_CONCAT(DISTINCT pi.image_path SEPARATOR ',') as images
        FROM products p
        LEFT JOIN product_descriptions pd ON p.id = pd.product_id
        LEFT JOIN product_images pi ON p.id = pi.product_id
        WHERE p.id = ?
        GROUP BY p.id
    `, [id]);

    if (products.length === 0) {
        const error = new CustomError('Produkt nie został znaleziony', 404);
        return next(error);
    }

    const product = {
        ...products[0],
        descriptions: products[0].descriptions ? products[0].descriptions.split('|||') : [],
        images: products[0].images ? products[0].images.split(',') : []
    };

    res.status(200).json({
        status: 'success',
        data: {
            product
        }
    });
});

// Aktualizuj produkt (tylko dla administratorów)
exports.updateProduct = [requireAdmin, asyncErrorHandler(async (req, res, next) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { id } = req.params;
        const { name, descriptions, category, price, offerPrice } = req.body;

        // Sprawdź czy produkt istnieje
        const [existing] = await connection.execute('SELECT id FROM products WHERE id = ?', [id]);
        if (existing.length === 0) {
            const error = new CustomError('Produkt nie został znaleziony', 404);
            return next(error);
        }

        // Aktualizuj podstawowe dane produktu
        await connection.execute(`
            UPDATE products 
            SET name = ?, category = ?, price = ?, offer_price = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
            WHERE id = ?
        `, [name, category, parseFloat(price), offerPrice ? parseFloat(offerPrice) : null, req.session.userId, id]);

        // Aktualizuj opisy jeśli podane
        if (descriptions) {
            await connection.execute('DELETE FROM product_descriptions WHERE product_id = ?', [id]);
            const descArray = descriptions.split(',').map(s => s.trim());
            for (const desc of descArray) {
                await connection.execute(`
                    INSERT INTO product_descriptions (product_id, description)
                    VALUES (?, ?)
                `, [id, desc]);
            }
        }

        // Aktualizuj zdjęcia jeśli podane
        if (req.files && req.files.length > 0) {
            await connection.execute('DELETE FROM product_images WHERE product_id = ?', [id]);
            for (const file of req.files) {
                await connection.execute(`
                    INSERT INTO product_images (product_id, image_path)
                    VALUES (?, ?)
                `, [id, file.filename]);
            }
        }

        await connection.commit();

        res.status(200).json({
            status: 'success',
            message: 'Produkt został zaktualizowany pomyślnie'
        });

    } catch (error) {
        await connection.rollback();
        const customError = new CustomError('Błąd podczas aktualizacji produktu', 500);
        return next(customError);
    } finally {
        connection.release();
    }
})];

// Usuń produkt (tylko dla administratorów)
exports.deleteProduct = [requireAdmin, asyncErrorHandler(async (req, res, next) => {
    const { id } = req.params;

    const [result] = await pool.execute('DELETE FROM products WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
        const error = new CustomError('Produkt nie został znaleziony', 404);
        return next(error);
    }

    res.status(204).json({
        status: 'success',
        message: 'Produkt został usunięty'
    });
})];

// Eksportuj middleware do użycia w innych miejscach
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;