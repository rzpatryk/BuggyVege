const asyncErrorHandler = require('../Utils/asyncErrorHandler');
const CustomError = require('../Utils/CustomError');

class BaseWalletController {
    constructor(walletService) {
        this.walletService = walletService;
    }

    getWalletBalance = asyncErrorHandler(async (req, res, next) => {
        try {
            const wallet = await this.walletService.getWalletBalance(req.user.id);
            
            res.status(200).json({
                status: 'success',
                data: {
                    balance: wallet.balance,
                    currency: wallet.currency,
                    formattedBalance: `${wallet.balance.toFixed(2)} ${wallet.currency}`
                }
            });
        } catch (error) {
            const customError = new CustomError(error.message, 404);
            return next(customError);
        }
    });

    depositToWallet = asyncErrorHandler(async (req, res, next) => {
        try {
            const { amount, paymentMethod, description } = req.body;
            const userId = req.user.id;

            const result = await this.walletService.depositToWallet(userId, {
                amount,
                paymentMethod,
                description
            });

            res.status(200).json({
                status: 'success',
                message: 'Portfel został pomyślnie doładowany',
                data: {
                    transaction: {
                        _id: result.transaction._id || result.transaction.id,
                        type: result.transaction.type,
                        amount: result.transaction.amount,
                        balanceAfter: result.transaction.balanceAfter || result.transaction.balance_after,
                        createdAt: result.transaction.createdAt || result.transaction.created_at
                    },
                    newBalance: result.newBalance,
                    formattedBalance: `${result.newBalance.toFixed(2)} PLN`
                }
            });
        } catch (error) {
            const customError = new CustomError(error.message, 400);
            return next(customError);
        }
    });

    getTransactionHistory = asyncErrorHandler(async (req, res, next) => {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 10, type } = req.query;

            const result = await this.walletService.getTransactionHistory(userId, {
                page: parseInt(page),
                limit: parseInt(limit),
                type
            });

            // Formatuj transakcje
            const formattedTransactions = result.transactions.map(transaction => ({
                _id: transaction._id || transaction.id,
                type: transaction.type,
                amount: transaction.amount,
                balanceBefore: transaction.balanceBefore || transaction.balance_before,
                balanceAfter: transaction.balanceAfter || transaction.balance_after,
                description: transaction.description,
                status: transaction.status,
                createdAt: transaction.createdAt || transaction.created_at,
                formattedAmount: `${transaction.amount.toFixed(2)} PLN`,
                formattedDate: new Date(transaction.createdAt || transaction.created_at).toLocaleDateString('pl-PL')
            }));

            res.status(200).json({
                status: 'success',
                results: result.transactions.length,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(result.total / limit),
                    totalTransactions: result.total,
                    hasNextPage: page < Math.ceil(result.total / limit),
                    hasPrevPage: page > 1
                },
                data: {
                    transactions: formattedTransactions
                }
            });
        } catch (error) {
            const customError = new CustomError(error.message, 500);
            return next(customError);
        }
    });

    purchaseWithWallet = asyncErrorHandler(async (req, res, next) => {
        try {
            const { items, shippingAddress } = req.body;
            const userId = req.user.id;

            const result = await this.walletService.purchaseWithWallet(userId, {
                items,
                shippingAddress
            });

            res.status(200).json({
                status: 'success',
                message: 'Zakup został zrealizowany pomyślnie',
                data: {
                    order: {
                        _id: result.order._id || result.order.id,
                        orderNumber: result.order.orderNumber || result.order.order_number,
                        totalAmount: result.order.totalAmount || result.order.total_amount,
                        status: result.order.status,
                        items: result.order.items
                    },
                    transaction: {
                        _id: result.transaction._id || result.transaction.id,
                        amount: result.transaction.amount,
                        balanceAfter: result.transaction.balanceAfter || result.transaction.balance_after
                    },
                    newBalance: result.newBalance,
                    formattedBalance: `${result.newBalance.toFixed(2)} PLN`
                }
            });
        } catch (error) {
            const customError = new CustomError(error.message, 400);
            return next(customError);
        }
    });

    getOrderHistory = asyncErrorHandler(async (req, res, next) => {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 10 } = req.query;

            const result = await this.walletService.getOrderHistory(userId, {
                page: parseInt(page),
                limit: parseInt(limit)
            });

            const formattedOrders = result.orders.map(order => ({
                _id: order._id || order.id,
                orderNumber: order.orderNumber || order.order_number,
                totalAmount: order.totalAmount || order.total_amount,
                status: order.status,
                itemCount: order.items?.length || order.itemCount || order.item_count,
                createdAt: order.createdAt || order.created_at,
                formattedAmount: `${(order.totalAmount || order.total_amount).toFixed(2)} PLN`,
                formattedDate: new Date(order.createdAt || order.created_at).toLocaleDateString('pl-PL')
            }));

            res.status(200).json({
                status: 'success',
                results: result.orders.length,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(result.total / limit),
                    totalOrders: result.total
                },
                data: {
                    orders: formattedOrders
                }
            });
        } catch (error) {
            const customError = new CustomError(error.message, 500);
            return next(customError);
        }
    });

    getOrderDetails = asyncErrorHandler(async (req, res, next) => {
        try {
            const { orderId } = req.params;
            const userId = req.user.id;

            const order = await this.walletService.getOrderDetails(userId, orderId);

            res.status(200).json({
                status: 'success',
                data: {
                    order
                }
            });
        } catch (error) {
            const customError = new CustomError(error.message, 404);
            return next(customError);
        }
    });

    refundOrder = asyncErrorHandler(async (req, res, next) => {
        try {
            const { orderId, reason } = req.body;
            const userId = req.user.id;

            const result = await this.walletService.refundOrder(userId, {
                orderId,
                reason
            });

            res.status(200).json({
                status: 'success',
                message: 'Zwrot został zrealizowany pomyślnie',
                data: {
                    refundAmount: result.refundAmount,
                    newBalance: result.newBalance,
                    formattedBalance: `${result.newBalance.toFixed(2)} PLN`,
                    transaction: {
                        _id: result.transaction._id || result.transaction.id,
                        type: result.transaction.type,
                        amount: result.transaction.amount
                    }
                }
            });
        } catch (error) {
            const customError = new CustomError(error.message, 400);
            return next(customError);
        }
    });
}

module.exports = BaseWalletController;