const User = require('../Models/userModel');
const Transaction = require('../Models/Transaction');
const Order = require('../Models/Order');
const Product = require('../Models/Product');
const asyncErrorHandler = require('../../Utils/asyncErrorHandler');
const CustomError = require('../../Utils/CustomError');

// Sprawdz saldo portfela
exports.getWalletBalance = asyncErrorHandler(async (req, res, next) => {
    const user = await User.findById(req.user._id);
    
    if (!user) {
        const error = new CustomError('Użytkownik nie istnieje', 404);
        return next(error);
    }

    res.status(200).json({
        status: 'success',
        data: {
            balance: user.wallet.balance,
            currency: user.wallet.currency,
            formattedBalance: `${user.wallet.balance.toFixed(2)} ${user.wallet.currency}`
        }
    });
});

// Doładuj portfel
exports.depositToWallet = asyncErrorHandler(async (req, res, next) => {
    const { amount, paymentMethod, description } = req.body;
    const userId = req.user._id;

    // Walidacja kwoty
    if (!amount || amount <= 0) {
        const error = new CustomError('Kwota musi być większa od 0', 400);
        return next(error);
    }

    if (amount > 10000) {
        const error = new CustomError('Maksymalna kwota doładowania to 10,000 PLN', 400);
        return next(error);
    }

    try {
        // Znajdź użytkownika
        const user = await User.findById(userId);
        if (!user) {
            const error = new CustomError('Użytkownik nie istnieje', 404);
            return next(error);
        }

        // Aktualizuj saldo
        const newBalance = user.wallet.balance + amount;
        await User.findByIdAndUpdate(userId, {
            'wallet.balance': newBalance
        });

        // Utwórz transakcję
        const transaction = await Transaction.create({
            user: userId,
            type: 'deposit',
            amount: amount,
            balanceBefore: user.wallet.balance,
            balanceAfter: newBalance,
            description: description || 'Doładowanie portfela',
            status: 'completed',
            metadata: {
                paymentMethod: paymentMethod || 'unknown',
                ipAddress: req.ip
            }
        });

        res.status(200).json({
            status: 'success',
            message: 'Portfel został pomyślnie doładowany',
            data: {
                transaction: {
                    _id: transaction._id,
                    type: transaction.type,
                    amount: transaction.amount,
                    balanceAfter: transaction.balanceAfter,
                    createdAt: transaction.createdAt
                },
                newBalance: newBalance,
                formattedBalance: `${newBalance.toFixed(2)} PLN`
            }
        });

    } catch (error) {
        const customError = new CustomError('Błąd podczas doładowywania portfela', 500);
        return next(customError);
    }
});

// Historia transakcji
exports.getTransactionHistory = asyncErrorHandler(async (req, res, next) => {
    const userId = req.user._id;
    const { page = 1, limit = 10, type } = req.query;

    // Buduj zapytanie
    const query = { user: userId };
    if (type) {
        query.type = type;
    }

    // Pobierz transakcje z paginacją
    const transactions = await Transaction.find(query)
        .sort('-createdAt')
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const total = await Transaction.countDocuments(query);

    // Formatuj transakcje
    const formattedTransactions = transactions.map(transaction => ({
        _id: transaction._id,
        type: transaction.type,
        amount: transaction.amount,
        balanceBefore: transaction.balanceBefore,
        balanceAfter: transaction.balanceAfter,
        description: transaction.description,
        status: transaction.status,
        createdAt: transaction.createdAt,
        formattedAmount: `${transaction.amount.toFixed(2)} PLN`,
        formattedDate: transaction.createdAt.toLocaleDateString('pl-PL')
    }));

    res.status(200).json({
        status: 'success',
        results: transactions.length,
        pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalTransactions: total,
            hasNextPage: page < Math.ceil(total / limit),
            hasPrevPage: page > 1
        },
        data: {
            transactions: formattedTransactions
        }
    });
});

// Kup produkty z portfela
exports.purchaseWithWallet = asyncErrorHandler(async (req, res, next) => {
    const { items, shippingAddress } = req.body;
    const userId = req.user._id;

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

    try {
        // Znajdź użytkownika
        const user = await User.findById(userId);
        if (!user) {
            const error = new CustomError('Użytkownik nie istnieje', 404);
            return next(error);
        }

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

            const product = await Product.findById(item.productId);
            if (!product) {
                const error = new CustomError(`Produkt o ID ${item.productId} nie istnieje`, 404);
                return next(error);
            }

            const price = Math.min(product.price, product.offerPrice || product.price);
            const itemTotal = price * item.quantity;
            totalAmount += itemTotal;

            // ✅ Poprawiona struktura zgodna z modelem Order
            orderItems.push({
                product: product._id,
                name: product.name,
                price: price,
                quantity: item.quantity,
                totalPrice: itemTotal // ✅ Zmienione z 'total' na 'totalPrice'
            });
        }

        console.log('Order items przed utworzeniem:', orderItems); // Debug

        // Sprawdź saldo portfela
        const currentBalance = user.wallet.balance;
        if (currentBalance < totalAmount) {
            const error = new CustomError(`Niewystarczające środki. Potrzebujesz ${totalAmount.toFixed(2)} PLN, masz ${currentBalance.toFixed(2)} PLN`, 400);
            return next(error);
        }

        // Oblicz nowe saldo
        const newBalance = currentBalance - totalAmount;

        // Aktualizuj saldo użytkownika
        await User.findByIdAndUpdate(userId, {
            'wallet.balance': newBalance
        });

        // Utwórz zamówienie
        const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        console.log('Dane zamówienia przed utworzeniem:', {
            orderNumber,
            user: userId,
            items: orderItems,
            totalAmount,
            shippingAddress,
            paymentMethod: 'wallet',
            status: 'pending'
        }); // Debug

        const order = await Order.create({
            orderNumber,
            user: userId,
            items: orderItems,
            totalAmount,
            shippingAddress,
            paymentMethod: 'wallet',
            status: 'pending'
        });

        console.log('Zamówienie utworzone pomyślnie:', order._id); // Debug

        // Utwórz transakcję płatności
        const transaction = await Transaction.create({
            user: userId,
            type: 'payment',
            amount: totalAmount,
            balanceBefore: currentBalance, // ✅ Używaj currentBalance
            balanceAfter: newBalance,
            description: `Zakup - zamówienie ${orderNumber}`,
            status: 'completed',
            relatedOrder: order._id,
            metadata: {
                orderNumber,
                itemCount: items.length,
                paymentMethod: 'wallet'
            }
        });

        res.status(200).json({
            status: 'success',
            message: 'Zakup został zrealizowany pomyślnie',
            data: {
                order: {
                    _id: order._id,
                    orderNumber: order.orderNumber,
                    totalAmount: order.totalAmount,
                    status: order.status,
                    items: orderItems
                },
                transaction: {
                    _id: transaction._id,
                    amount: transaction.amount,
                    balanceAfter: transaction.balanceAfter
                },
                newBalance: newBalance,
                formattedBalance: `${newBalance.toFixed(2)} PLN`
            }
        });

    } catch (error) {
        console.log('Błąd podczas realizacji zakupu:', error);
        
        const customError = new CustomError('Błąd podczas realizacji zakupu', 500);
        return next(customError);
    }
});

// Historia zamówień
exports.getOrderHistory = asyncErrorHandler(async (req, res, next) => {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    const orders = await Order.find({ user: userId })
        .populate('items.product', 'name images')
        .sort('-createdAt')
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const total = await Order.countDocuments({ user: userId });

    const formattedOrders = orders.map(order => ({
        _id: order._id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        status: order.status,
        itemCount: order.items.length,
        createdAt: order.createdAt,
        formattedAmount: `${order.totalAmount.toFixed(2)} PLN`,
        formattedDate: order.createdAt.toLocaleDateString('pl-PL')
    }));

    res.status(200).json({
        status: 'success',
        results: orders.length,
        pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalOrders: total
        },
        data: {
            orders: formattedOrders
        }
    });
});

// Szczegóły zamówienia
exports.getOrderDetails = asyncErrorHandler(async (req, res, next) => {
    const { orderId } = req.params;
    const userId = req.user._id;

    const order = await Order.findOne({
        _id: orderId,
        user: userId
    }).populate('items.product', 'name images price');

    if (!order) {
        const error = new CustomError('Zamówienie nie istnieje', 404);
        return next(error);
    }

    res.status(200).json({
        status: 'success',
        data: {
            order
        }
    });
});

// Zwrot zamówienia
exports.refundOrder = asyncErrorHandler(async (req, res, next) => {
    const { orderId, reason } = req.body;
    const userId = req.user._id;

    if (!orderId || !reason) {
        const error = new CustomError('ID zamówienia i powód zwrotu są wymagane', 400);
        return next(error);
    }

    try {
        // Znajdź zamówienie
        const order = await Order.findOne({
            _id: orderId,
            user: userId
        });

        if (!order) {
            const error = new CustomError('Zamówienie nie istnieje', 404);
            return next(error);
        }

        if (order.status === 'refunded') {
            const error = new CustomError('Zamówienie zostało już zwrócone', 400);
            return next(error);
        }

        if (order.status !== 'delivered') {
            const error = new CustomError('Można zwrócić tylko dostarczone zamówienia', 400);
            return next(error);
        }

        // Znajdź użytkownika
        const user = await User.findById(userId);
        const refundAmount = order.totalAmount;
        const newBalance = user.wallet.balance + refundAmount;

        // Aktualizuj saldo użytkownika
        await User.findByIdAndUpdate(userId, {
            'wallet.balance': newBalance
        });

        // Aktualizuj status zamówienia
        await Order.findByIdAndUpdate(orderId, {
            status: 'refunded',
            refundReason: reason,
            refundDate: new Date()
        });

        // Utwórz transakcję zwrotu
        const transaction = await Transaction.create({
            user: userId,
            type: 'refund',
            amount: refundAmount,
            balanceBefore: user.wallet.balance,
            balanceAfter: newBalance,
            description: `Zwrot za zamówienie ${order.orderNumber}`,
            status: 'completed',
            relatedOrder: order._id,
            metadata: {
                refundReason: reason,
                originalOrderNumber: order.orderNumber
            }
        });

        res.status(200).json({
            status: 'success',
            message: 'Zwrot został zrealizowany pomyślnie',
            data: {
                refundAmount: refundAmount,
                newBalance: newBalance,
                formattedBalance: `${newBalance.toFixed(2)} PLN`,
                transaction: {
                    _id: transaction._id,
                    type: transaction.type,
                    amount: transaction.amount
                }
            }
        });

    } catch (error) {
        const customError = new CustomError('Błąd podczas realizacji zwrotu', 500);
        return next(customError);
    }
});
