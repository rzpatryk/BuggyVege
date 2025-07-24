const User = require('../Models/userModel');
const Transaction = require('../Models/Transaction');
const Order = require('../Models/Order');
const asyncErrorHandler = require('../Utils/asyncErrorHandler');
const CustomError = require('../Utils/CustomError');
const mongoose = require('mongoose');

// Sprawdź saldo portfela
exports.getWalletBalance = asyncErrorHandler(async (req, res, next) => {
    const user = await User.findById(req.user._id).select('+wallet');
    
    if (!user) {
        const error = new CustomError('Użytkownik nie został znaleziony', 404);
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
    const { amount, paymentMethod = 'card', description } = req.body;

    // Walidacja kwoty
    if (!amount || amount <= 0) {
        const error = new CustomError('Kwota doładowania musi być większa od 0', 400);
        return next(error);
    }

    if (amount > 10000) {
        const error = new CustomError('Maksymalna kwota doładowania to 10,000 PLN', 400);
        return next(error);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Znajdź użytkownika
        const user = await User.findById(req.user._id).select('+wallet').session(session);
        
        if (!user) {
            throw new CustomError('Użytkownik nie został znaleziony', 404);
        }

        const balanceBefore = user.wallet.balance;
        const balanceAfter = balanceBefore + amount;

        // Zaktualizuj saldo użytkownika
        user.wallet.balance = balanceAfter;
        await user.save({ session });

        // Utwórz transakcję
        const transaction = new Transaction({
            user: user._id,
            type: 'deposit',
            amount: amount,
            description: description || `Doładowanie portfela - ${paymentMethod}`,
            balanceBefore: balanceBefore,
            balanceAfter: balanceAfter,
            status: 'completed',
            metadata: {
                paymentMethod: paymentMethod,
                ipAddress: req.ip
            }
        });

        await transaction.save({ session });

        await session.commitTransaction();

        res.status(201).json({
            status: 'success',
            message: 'Portfel został pomyślnie doładowany',
            data: {
                transaction: transaction,
                newBalance: balanceAfter,
                formattedBalance: `${balanceAfter.toFixed(2)} PLN`
            }
        });

    } catch (error) {
        await session.abortTransaction();
        return next(error);
    } finally {
        session.endSession();
    }
});

// Historia transakcji
exports.getTransactionHistory = asyncErrorHandler(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const type = req.query.type; // 'deposit', 'payment', 'refund'
    const skip = (page - 1) * limit;

    // Buduj query
    const query = { user: req.user._id };
    if (type) {
        query.type = type;
    }

    // Pobierz transakcje
    const transactions = await Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-user'); // Nie pobieraj danych użytkownika (mamy już w req.user)

    // Policz wszystkie transakcje dla paginacji
    const totalTransactions = await Transaction.countDocuments(query);
    const totalPages = Math.ceil(totalTransactions / limit);

    res.status(200).json({
        status: 'success',
        results: transactions.length,
        pagination: {
            currentPage: page,
            totalPages: totalPages,
            totalTransactions: totalTransactions,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        },
        data: {
            transactions
        }
    });
});

// Kup produkty za pomocą portfela
exports.purchaseWithWallet = asyncErrorHandler(async (req, res, next) => {
    const { items, shippingAddress } = req.body;
    
    // Walidacja items
    if (!items || !Array.isArray(items) || items.length === 0) {
        const error = new CustomError('Lista produktów jest wymagana', 400);
        return next(error);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Znajdź użytkownika
        const user = await User.findById(req.user._id).select('+wallet').session(session);
        
        if (!user) {
            throw new CustomError('Użytkownik nie został znaleziony', 404);
        }

        // Sprawdź i oblicz ceny produktów
        let totalAmount = 0;
        const orderItems = [];

        for (const item of items) {
            const Product = require('../Models/Product');
            const product = await Product.findById(item.productId).session(session);
            
            if (!product) {
                throw new CustomError(`Produkt ${item.productId} nie został znaleziony`, 404);
            }

            const quantity = parseInt(item.quantity) || 1;
            const price = product.offerPrice || product.price;
            const itemTotal = price * quantity;
            
            totalAmount += itemTotal;
            
            orderItems.push({
                product: product._id,
                quantity: quantity,
                price: price,
                totalPrice: itemTotal
            });
        }

        // Sprawdź czy użytkownik ma wystarczające środki
        if (user.wallet.balance < totalAmount) {
            throw new CustomError(`Niewystarczające środki w portfelu. Potrzebujesz ${totalAmount.toFixed(2)} PLN, masz ${user.wallet.balance.toFixed(2)} PLN`, 400);
        }

        const balanceBefore = user.wallet.balance;
        const balanceAfter = balanceBefore - totalAmount;

        // Utwórz zamówienie
        const order = new Order({
            user: user._id,
            items: orderItems,
            totalAmount: totalAmount,
            paymentMethod: 'wallet',
            paymentStatus: 'paid',
            status: 'paid',
            shippingAddress: shippingAddress
        });

        await order.save({ session });

        // Utwórz transakcję płatności
        const transaction = new Transaction({
            user: user._id,
            type: 'payment',
            amount: totalAmount,
            description: `Zakup produktów - zamówienie #${order.orderNumber}`,
            balanceBefore: balanceBefore,
            balanceAfter: balanceAfter,
            relatedOrder: order._id,
            status: 'completed',
            metadata: {
                paymentMethod: 'wallet',
                ipAddress: req.ip
            }
        });

        await transaction.save({ session });

        // Zaktualizuj saldo użytkownika
        user.wallet.balance = balanceAfter;
        await user.save({ session });

        // Zaktualizuj zamówienie z transakcją
        order.transaction = transaction._id;
        await order.save({ session });

        await session.commitTransaction();

        res.status(201).json({
            status: 'success',
            message: 'Zakup został pomyślnie zrealizowany',
            data: {
                order: order,
                transaction: transaction,
                newBalance: balanceAfter,
                formattedBalance: `${balanceAfter.toFixed(2)} PLN`
            }
        });

    } catch (error) {
        await session.abortTransaction();
        return next(error);
    } finally {
        session.endSession();
    }
});

// Historia zamówień użytkownika
exports.getOrderHistory = asyncErrorHandler(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const skip = (page - 1) * limit;

    // Buduj query
    const query = { user: req.user._id };
    if (status) {
        query.status = status;
    }

    // Pobierz zamówienia
    const orders = await Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-user'); // Nie pobieraj danych użytkownika

    // Policz wszystkie zamówienia dla paginacji  
    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    res.status(200).json({
        status: 'success',
        results: orders.length,
        pagination: {
            currentPage: page,
            totalPages: totalPages,
            totalOrders: totalOrders,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        },
        data: {
            orders
        }
    });
});

// Szczegóły zamówienia
exports.getOrderDetails = asyncErrorHandler(async (req, res, next) => {
    const order = await Order.findOne({
        _id: req.params.orderId,
        user: req.user._id
    }).populate('transaction');

    if (!order) {
        const error = new CustomError('Zamówienie nie zostało znalezione', 404);
        return next(error);
    }

    res.status(200).json({
        status: 'success',
        data: {
            order
        }
    });
});

// Zwrot środków (refund)
exports.refundOrder = asyncErrorHandler(async (req, res, next) => {
    const { orderId, reason } = req.body;

    if (!orderId) {
        const error = new CustomError('ID zamówienia jest wymagane', 400);
        return next(error);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Znajdź zamówienie
        const order = await Order.findOne({
            _id: orderId,
            user: req.user._id
        }).session(session);

        if (!order) {
            throw new CustomError('Zamówienie nie zostało znalezione', 404);
        }

        if (order.status === 'refunded') {
            throw new CustomError('To zamówienie zostało już zwrócone', 400);
        }

        if (order.paymentMethod !== 'wallet') {
            throw new CustomError('Można zwrócić tylko zamówienia opłacone z portfela', 400);
        }

        // Znajdź użytkownika
        const user = await User.findById(req.user._id).select('+wallet').session(session);
        
        const balanceBefore = user.wallet.balance;
        const refundAmount = order.totalAmount;
        const balanceAfter = balanceBefore + refundAmount;

        // Utwórz transakcję zwrotu
        const refundTransaction = new Transaction({
            user: user._id,
            type: 'refund',
            amount: refundAmount,
            description: `Zwrot za zamówienie #${order.orderNumber} - ${reason || 'Zwrot zamówienia'}`,
            balanceBefore: balanceBefore,
            balanceAfter: balanceAfter,
            relatedOrder: order._id,
            status: 'completed',
            metadata: {
                originalOrderId: order._id,
                refundReason: reason,
                ipAddress: req.ip
            }
        });

        await refundTransaction.save({ session });

        // Zaktualizuj saldo użytkownika
        user.wallet.balance = balanceAfter;
        await user.save({ session });

        // Zaktualizuj status zamówienia
        order.status = 'refunded';
        order.paymentStatus = 'refunded';
        await order.save({ session });

        await session.commitTransaction();

        res.status(200).json({
            status: 'success',
            message: 'Zwrot został pomyślnie zrealizowany',
            data: {
                refundTransaction: refundTransaction,
                newBalance: balanceAfter,
                formattedBalance: `${balanceAfter.toFixed(2)} PLN`
            }
        });

    } catch (error) {
        await session.abortTransaction();
        return next(error);
    } finally {
        session.endSession();
    }
});
