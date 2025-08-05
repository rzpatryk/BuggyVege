const WalletDatabaseAdapter = require('./WalletDatabaseAdapter');
const User = require('../../Models/userModel');
const Transaction = require('../../Models/Transaction');
const Order = require('../../Models/Order');
const Product = require('../../Models/Product');

class MongoWalletAdapter extends WalletDatabaseAdapter {
    async getUserWallet(userId) {
        const user = await User.findById(userId);
        if (!user) return null;
        
        return {
            id: user._id.toString(),
            balance: user.wallet.balance,
            currency: user.wallet.currency
        };
    }

    async updateUserBalance(userId, newBalance) {
        await User.findByIdAndUpdate(userId, {
            'wallet.balance': newBalance
        });
        return newBalance;
    }

    async createTransaction(transactionData) {
        const transaction = await Transaction.create(transactionData);
        return transaction;
    }

    async getTransactionHistory(userId, filters = {}) {
        const { page = 1, limit = 10, type } = filters;
        
        const query = { user: userId };
        if (type) {
            query.type = type;
        }

        const transactions = await Transaction.find(query)
            .sort('-createdAt')
            .limit(limit * 1)
            .skip((page - 1) * limit);

        return transactions;
    }

    async getTransactionCount(userId, filters = {}) {
        const query = { user: userId };
        if (filters.type) {
            query.type = filters.type;
        }
        
        return await Transaction.countDocuments(query);
    }

    async createOrder(orderData) {
        const order = await Order.create(orderData);
        return order;
    }

    async getOrderById(orderId, userId) {
        const order = await Order.findOne({
            _id: orderId,
            user: userId
        }).populate('items.product', 'name images price');
        
        return order;
    }

    async getOrderHistory(userId, filters = {}) {
        const { page = 1, limit = 10 } = filters;
        
        const orders = await Order.find({ user: userId })
            .populate('items.product', 'name images')
            .sort('-createdAt')
            .limit(limit * 1)
            .skip((page - 1) * limit);

        return orders;
    }

    async getOrderCount(userId) {
        return await Order.countDocuments({ user: userId });
    }

    async updateOrderStatus(orderId, status, additionalData = {}) {
        const updateData = { status, ...additionalData };
        const order = await Order.findByIdAndUpdate(
            orderId, 
            updateData, 
            { new: true }
        );
        return order;
    }

    async getProductById(productId) {
        const product = await Product.findById(productId);
        return product;
    }

    async getUserById(userId) {
        const user = await User.findById(userId);
        if (!user) return null;
        
        return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            wallet: {
                balance: user.wallet.balance,
                currency: user.wallet.currency
            }
        };
    }
}

module.exports = MongoWalletAdapter;