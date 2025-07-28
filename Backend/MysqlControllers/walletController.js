const { pool } = require('../database');
const asyncErrorHandler = require('../Utils/asyncErrorHandler');
const CustomError = require('../Utils/CustomError');

// Sprawdź saldo portfela
exports.getWalletBalance = asyncErrorHandler(async (req, res, next) => {
    const userId = req.user.id;

    const [users] = await pool.execute(`
        SELECT wallet_balance FROM users WHERE id = ?
    `, [userId]);

    if (users.length === 0) {
        const error = new CustomError('Użytkownik nie istnieje', 404);
        return next(error);
    }

    res.status(200).json({
        status: 'success',
        data: {
            balance: users[0].wallet_balance,
            currency: 'PLN',
            formattedBalance: `${users[0].wallet_balance.toFixed(2)} PLN`
        }
    });
});

// Doładuj portfel
exports.depositToWallet = asyncErrorHandler(async (req, res, next) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { amount, paymentMethod, description } = req.body;
        const userId = req.user.id;

        // Walidacja kwoty
        if (!amount || amount <= 0) {
            const error = new CustomError('Kwota musi być większa od 0', 400);
            return next(error);
        }

        if (amount > 10000) {
            const error = new CustomError('Maksymalna kwota doładowania to 10,000 PLN', 400);
            return next(error);
        }

        // Pobierz obecne saldo
        const [users] = await connection.execute(`
            SELECT wallet_balance FROM users WHERE id = ?
        `, [userId]);

        if (users.length === 0) {
            const error = new CustomError('Użytkownik nie istnieje', 404);
            return next(error);
        }

        const currentBalance = users[0].wallet_balance;
        const newBalance = currentBalance + amount;

        // Aktualizuj saldo
        await connection.execute(`
            UPDATE users SET wallet_balance = ? WHERE id = ?
        `, [newBalance, userId]);

        // Utwórz transakcję
        const [result] = await connection.execute(`
            INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, description, payment_method, ip_address)
            VALUES (?, 'deposit', ?, ?, ?, ?, ?, ?)
        `, [userId, amount, currentBalance, newBalance, description || 'Doładowanie portfela', paymentMethod || 'unknown', req.ip]);

        await connection.commit();

        res.status(200).json({
            status: 'success',
            message: 'Portfel został pomyślnie doładowany',
            data: {
                transactionId: result.insertId,
                amount: amount,
                newBalance: newBalance,
                formattedBalance: `${newBalance.toFixed(2)} PLN`
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Błąd doładowania portfela:', error);
        const customError = new CustomError('Błąd podczas doładowywania portfela', 500);
        return next(customError);
    } finally {
        connection.release();
    }
});

// Kup produkty z portfela
exports.purchaseWithWallet = asyncErrorHandler(async (req, res, next) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { items, shippingAddress } = req.body;
        const userId = req.user.id;

        // Walidacja danych
        if (!items || !Array.isArray(items) || items.length === 0) {
            const error = new CustomError('Lista produktów jest wymagana', 400);
            return next(error);
        }

        // Pobierz obecne saldo
        const [users] = await connection.execute(`
            SELECT wallet_balance FROM users WHERE id = ?
        `, [userId]);

        if (users.length === 0) {
            const error = new CustomError('Użytkownik nie istnieje', 404);
            return next(error);
        }

        const currentBalance = users[0].wallet_balance;

        // Oblicz całkowitą cenę
        let totalAmount = 0;
        const orderItems = [];

        for (const item of items) {
            const [products] = await connection.execute(`
                SELECT id, name, price, offer_price FROM products WHERE id = ?
            `, [item.productId]);

            if (products.length === 0) {
                const error = new CustomError(`Produkt o ID ${item.productId} nie istnieje`, 404);
                return next(error);
            }

            const product = products[0];
            const price = Math.min(product.price, product.offer_price || product.price);
            const itemTotal = price * item.quantity;
            totalAmount += itemTotal;

            orderItems.push({
                product_id: product.id,
                quantity: item.quantity,
                price: price,
                total_price: itemTotal
            });
        }

        // Sprawdź saldo
        if (currentBalance < totalAmount) {
            const error = new CustomError(`Niewystarczające środki. Potrzebujesz ${totalAmount.toFixed(2)} PLN, masz ${currentBalance.toFixed(2)} PLN`, 400);
            return next(error);
        }

        const newBalance = currentBalance - totalAmount;

        // Utwórz zamówienie
        const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const [orderResult] = await connection.execute(`
            INSERT INTO orders (user_id, order_number, total_amount, payment_method, shipping_street, shipping_city, shipping_postal_code, shipping_country)
            VALUES (?, ?, ?, 'wallet', ?, ?, ?, ?)
        `, [userId, orderNumber, totalAmount, shippingAddress.street, shippingAddress.city, shippingAddress.postalCode, shippingAddress.country || 'Polska']);

        const orderId = orderResult.insertId;

        // Dodaj pozycje zamówienia
        for (const item of orderItems) {
            await connection.execute(`
                INSERT INTO order_items (order_id, product_id, quantity, price, total_price)
                VALUES (?, ?, ?, ?, ?)
            `, [orderId, item.product_id, item.quantity, item.price, item.total_price]);
        }

        // Aktualizuj saldo użytkownika
        await connection.execute(`
            UPDATE users SET wallet_balance = ? WHERE id = ?
        `, [newBalance, userId]);

        // Utwórz transakcję płatności
        await connection.execute(`
            INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, description, related_order_id, payment_method)
            VALUES (?, 'payment', ?, ?, ?, ?, ?, 'wallet')
        `, [userId, totalAmount, currentBalance, newBalance, `Zakup - zamówienie ${orderNumber}`, orderId]);

        await connection.commit();

        res.status(200).json({
            status: 'success',
            message: 'Zakup został zrealizowany pomyślnie',
            data: {
                orderId: orderId,
                orderNumber: orderNumber,
                totalAmount: totalAmount,
                newBalance: newBalance,
                formattedBalance: `${newBalance.toFixed(2)} PLN`
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Błąd zakupu:', error);
        const customError = new CustomError('Błąd podczas realizacji zakupu', 500);
        return next(customError);
    } finally {
        connection.release();
    }
});

// Historia transakcji
exports.getTransactionHistory = asyncErrorHandler(async (req, res, next) => {
    const userId = req.user.id;
    const { page = 1, limit = 10, type } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE user_id = ?';
    let params = [userId];

    if (type) {
        whereClause += ' AND type = ?';
        params.push(type);
    }

    const [transactions] = await pool.execute(`
        SELECT * FROM transactions 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    const [countResult] = await pool.execute(`
        SELECT COUNT(*) as total FROM transactions ${whereClause}
    `, params);

    res.status(200).json({
        status: 'success',
        results: transactions.length,
        pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(countResult[0].total / limit),
            totalTransactions: countResult[0].total
        },
        data: {
            transactions: transactions.map(t => ({
                ...t,
                formattedAmount: `${t.amount.toFixed(2)} PLN`,
                formattedDate: new Date(t.created_at).toLocaleDateString('pl-PL')
            }))
        }
    });
});