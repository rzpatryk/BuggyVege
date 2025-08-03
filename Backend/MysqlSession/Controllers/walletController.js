const { pool } = require('../../database');
const asyncErrorHandler = require('../../Utils/asyncErrorHandler');
const CustomError = require('../../Utils/CustomError');

// Sprawdź saldo portfela
exports.getWalletBalance = asyncErrorHandler(async (req, res, next) => {
    // Sprawdź czy użytkownik jest zalogowany
    if (!req.session.user || !req.session.user.id) {
        const error = new CustomError('Musisz być zalogowany', 401);
        return next(error);
    }

    const userId = req.session.user.id;

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
    // Sprawdź czy użytkownik jest zalogowany
    if (!req.session.user || !req.session.user.id) {
        const error = new CustomError('Musisz być zalogowany', 401);
        return next(error);
    }

    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { amount, paymentMethod, description } = req.body;
        const userId = req.session.user.id;

        const amountNum = parseFloat(amount);
        if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
            const error = new CustomError('Kwota musi być prawidłową liczbą większą od 0', 400);
            return next(error);
        }

        if (amountNum > 10000) {
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
        
        const currentBalance = parseFloat(users[0].wallet_balance) || 0;
        const newBalance = currentBalance + amountNum;

        // Aktualizuj saldo
        await connection.execute(`
            UPDATE users SET wallet_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `, [newBalance, userId]);

        // Utwórz transakcję
        const [result] = await connection.execute(`
            INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, description, payment_method, ip_address)
            VALUES (?, 'deposit', ?, ?, ?, ?, ?, ?)
        `, [userId, amountNum, currentBalance, newBalance, description || 'Doładowanie portfela', paymentMethod || 'unknown', req.ip]);

        await connection.commit();

        res.status(200).json({
            status: 'success',
            message: 'Portfel został pomyślnie doładowany',
            data: {
                transaction: {
                    id: result.insertId,
                    type: 'deposit',
                    amount: amountNum,
                    balanceAfter: newBalance,
                    createdAt: new Date()
                },
                newBalance: newBalance
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

// Historia transakcji
exports.getTransactionHistory = asyncErrorHandler(async (req, res, next) => {
    // Sprawdź czy użytkownik jest zalogowany
    if (!req.session.user || !req.session.user.id) {
        const error = new CustomError('Musisz być zalogowany', 401);
        return next(error);
    }

    const userId = req.session.user.id;
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

    // Formatuj transakcje
    const formattedTransactions = transactions.map(transaction => ({
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        balanceBefore: transaction.balance_before,
        balanceAfter: transaction.balance_after,
        description: transaction.description,
        status: transaction.status,
        createdAt: transaction.created_at,
        formattedAmount: `${transaction.amount.toFixed(2)} PLN`,
        formattedDate: new Date(transaction.created_at).toLocaleDateString('pl-PL')
    }));

    res.status(200).json({
        status: 'success',
        results: transactions.length,
        pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(countResult[0].total / limit),
            totalTransactions: countResult[0].total,
            hasNextPage: page < Math.ceil(countResult[0].total / limit),
            hasPrevPage: page > 1
        },
        data: {
            transactions: formattedTransactions
        }
    });
});

// Kup produkty z portfela
exports.purchaseWithWallet = asyncErrorHandler(async (req, res, next) => {
    // Sprawdź czy użytkownik jest zalogowany
    if (!req.session.user || !req.session.user.id) {
        const error = new CustomError('Musisz być zalogowany', 401);
        return next(error);
    }

    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { items, shippingAddress } = req.body;
        const userId = req.session.user.id;

        // Walidacja danych
        if (!items || !Array.isArray(items) || items.length === 0) {
            const error = new CustomError('Lista produktów jest wymagana', 400);
            return next(error);
        }

        if (!shippingAddress) {
            const error = new CustomError('Adres dostawy jest wymagany', 400);
            return next(error);
        }

        // Walidacja adresu dostawy
        const requiredFields = ['street', 'city', 'postalCode', 'country'];
        for (const field of requiredFields) {
            if (!shippingAddress[field]) {
                const error = new CustomError(`Pole ${field} w adresie dostawy jest wymagane`, 400);
                return next(error);
            }
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

        // Pobierz produkty i oblicz cenę
        let totalAmount = 0;
        const orderItems = [];

        for (const item of items) {
            if (!item.productId || !item.quantity) {
                const error = new CustomError('ProductId i quantity są wymagane dla każdego produktu', 400);
                return next(error);
            }

            if (item.quantity <= 0) {
                const error = new CustomError('Ilość musi być większa od 0', 400);
                return next(error);
            }

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
                name: product.name,
                quantity: item.quantity,
                price: price,
                total_price: itemTotal
            });
        }

        // Sprawdź saldo portfela
        if (currentBalance < totalAmount) {
            const error = new CustomError(`Niewystarczające środki. Potrzebujesz ${totalAmount.toFixed(2)} PLN, masz ${currentBalance.toFixed(2)} PLN`, 400);
            return next(error);
        }

        // Oblicz nowe saldo
        const newBalance = currentBalance - totalAmount;

        // Utwórz zamówienie
        const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const [orderResult] = await connection.execute(`
            INSERT INTO orders (user_id, order_number, total_amount, payment_method, status, 
                               shipping_street, shipping_city, shipping_postal_code, shipping_country)
            VALUES (?, ?, ?, 'wallet', 'pending', ?, ?, ?, ?)
        `, [userId, orderNumber, totalAmount, shippingAddress.street, shippingAddress.city, 
            shippingAddress.postalCode, shippingAddress.country || 'Polska']);

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
            UPDATE users SET wallet_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `, [newBalance, userId]);

        // Utwórz transakcję płatności
        const [transactionResult] = await connection.execute(`
            INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, 
                                    description, related_order_id, payment_method)
            VALUES (?, 'payment', ?, ?, ?, ?, ?, 'wallet')
        `, [userId, totalAmount, currentBalance, newBalance, `Zakup - zamówienie ${orderNumber}`, orderId]);

        await connection.commit();

        res.status(200).json({
            status: 'success',
            message: 'Zakup został zrealizowany pomyślnie',
            data: {
                order: {
                    id: orderId,
                    orderNumber: orderNumber,
                    totalAmount: totalAmount,
                    status: 'pending',
                    items: orderItems
                },
                transaction: {
                    id: transactionResult.insertId,
                    amount: totalAmount,
                    balanceAfter: newBalance
                },
                newBalance: newBalance,
                formattedBalance: `${newBalance.toFixed(2)} PLN`
            }
        });

    } catch (error) {
        await connection.rollback();
        console.log('Błąd podczas realizacji zakupu:', error);
        
        const customError = new CustomError('Błąd podczas realizacji zakupu', 500);
        return next(customError);
    } finally {
        connection.release();
    }
});

// Historia zamówień
exports.getOrderHistory = asyncErrorHandler(async (req, res, next) => {
    // Sprawdź czy użytkownik jest zalogowany
    if (!req.session.user || !req.session.user.id) {
        const error = new CustomError('Musisz być zalogowany', 401);
        return next(error);
    }

    const userId = req.session.user.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const [orders] = await pool.execute(`
        SELECT o.*, COUNT(oi.id) as item_count
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.user_id = ?
        GROUP BY o.id
        ORDER BY o.created_at DESC
        LIMIT ? OFFSET ?
    `, [userId, parseInt(limit), offset]);

    const [countResult] = await pool.execute(`
        SELECT COUNT(*) as total FROM orders WHERE user_id = ?
    `, [userId]);

    const formattedOrders = orders.map(order => ({
        id: order.id,
        orderNumber: order.order_number,
        totalAmount: order.total_amount,
        status: order.status,
        itemCount: order.item_count,
        createdAt: order.created_at,
        formattedAmount: `${order.total_amount.toFixed(2)} PLN`,
        formattedDate: new Date(order.created_at).toLocaleDateString('pl-PL')
    }));

    res.status(200).json({
        status: 'success',
        results: orders.length,
        pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(countResult[0].total / limit),
            totalOrders: countResult[0].total
        },
        data: {
            orders: formattedOrders
        }
    });
});

// Szczegóły zamówienia
exports.getOrderDetails = asyncErrorHandler(async (req, res, next) => {
    // Sprawdź czy użytkownik jest zalogowany
    if (!req.session.user || !req.session.user.id) {
        const error = new CustomError('Musisz być zalogowany', 401);
        return next(error);
    }

    const { orderId } = req.params;
    const userId = req.session.user.id;

    const [orders] = await pool.execute(`
        SELECT o.*, 
               oi.product_id, oi.quantity, oi.price, oi.total_price,
               p.name as product_name
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.id = ? AND o.user_id = ?
    `, [orderId, userId]);

    if (orders.length === 0) {
        const error = new CustomError('Zamówienie nie istnieje', 404);
        return next(error);
    }

    // Grupuj dane zamówienia
    const order = {
        id: orders[0].id,
        orderNumber: orders[0].order_number,
        totalAmount: orders[0].total_amount,
        status: orders[0].status,
        paymentMethod: orders[0].payment_method,
        shippingAddress: {
            street: orders[0].shipping_street,
            city: orders[0].shipping_city,
            postalCode: orders[0].shipping_postal_code,
            country: orders[0].shipping_country
        },
        createdAt: orders[0].created_at,
        items: orders.map(item => ({
            productId: item.product_id,
            productName: item.product_name,
            quantity: item.quantity,
            price: item.price,
            totalPrice: item.total_price
        }))
    };

    res.status(200).json({
        status: 'success',
        data: {
            order
        }
    });
});

// Zwrot zamówienia
exports.refundOrder = asyncErrorHandler(async (req, res, next) => {
    // Sprawdź czy użytkownik jest zalogowany
    if (!req.session.user || !req.session.user.id) {
        const error = new CustomError('Musisz być zalogowany', 401);
        return next(error);
    }

    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { orderId, reason } = req.body;
        const userId = req.session.user.id;

        if (!orderId || !reason) {
            const error = new CustomError('ID zamówienia i powód zwrotu są wymagane', 400);
            return next(error);
        }

        // Znajdź zamówienie
        const [orders] = await connection.execute(`
            SELECT * FROM orders WHERE id = ? AND user_id = ?
        `, [orderId, userId]);

        if (orders.length === 0) {
            const error = new CustomError('Zamówienie nie istnieje', 404);
            return next(error);
        }

        const order = orders[0];

        if (order.status === 'refunded') {
            const error = new CustomError('Zamówienie zostało już zwrócone', 400);
            return next(error);
        }

        if (order.status !== 'delivered') {
            const error = new CustomError('Można zwrócić tylko dostarczone zamówienia', 400);
            return next(error);
        }

        // Pobierz obecne saldo użytkownika
        const [users] = await connection.execute(`
            SELECT wallet_balance FROM users WHERE id = ?
        `, [userId]);

        const currentBalance = users[0].wallet_balance;
        const refundAmount = order.total_amount;
        const newBalance = currentBalance + refundAmount;

        // Aktualizuj saldo użytkownika
        await connection.execute(`
            UPDATE users SET wallet_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `, [newBalance, userId]);

        // Aktualizuj status zamówienia
        await connection.execute(`
            UPDATE orders SET status = 'refunded', notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `, [`Zwrot: ${reason}`, orderId]);

        // Utwórz transakcję zwrotu
        const [transactionResult] = await connection.execute(`
            INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, 
                                    description, related_order_id, payment_method)
            VALUES (?, 'refund', ?, ?, ?, ?, ?, 'wallet')
        `, [userId, refundAmount, currentBalance, newBalance, 
            `Zwrot za zamówienie ${order.order_number}`, orderId]);

        await connection.commit();

        res.status(200).json({
            status: 'success',
            message: 'Zwrot został zrealizowany pomyślnie',
            data: {
                refundAmount: refundAmount,
                newBalance: newBalance,
                formattedBalance: `${newBalance.toFixed(2)} PLN`,
                transaction: {
                    id: transactionResult.insertId,
                    type: 'refund',
                    amount: refundAmount
                }
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Błąd zwrotu:', error);
        const customError = new CustomError('Błąd podczas realizacji zwrotu', 500);
        return next(customError);
    } finally {
        connection.release();
    }
});