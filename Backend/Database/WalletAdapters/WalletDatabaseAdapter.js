class WalletDatabaseAdapter {
    async getUserWallet(userId) {
        throw new Error('Method must be implemented');
    }

    async updateUserBalance(userId, newBalance) {
        throw new Error('Method must be implemented');
    }

    async createTransaction(transactionData) {
        throw new Error('Method must be implemented');
    }

    async getTransactionHistory(userId, filters = {}) {
        throw new Error('Method must be implemented');
    }

    async getTransactionCount(userId, filters = {}) {
        throw new Error('Method must be implemented');
    }

    async createOrder(orderData) {
        throw new Error('Method must be implemented');
    }

    async getOrderById(orderId, userId) {
        throw new Error('Method must be implemented');
    }

    async getOrderHistory(userId, filters = {}) {
        throw new Error('Method must be implemented');
    }

    async getOrderCount(userId) {
        throw new Error('Method must be implemented');
    }

    async updateOrderStatus(orderId, status, additionalData = {}) {
        throw new Error('Method must be implemented');
    }

    async getProductById(productId) {
        throw new Error('Method must be implemented');
    }

    async getUserById(userId) {
        throw new Error('Method must be implemented');
    }
}

module.exports = WalletDatabaseAdapter;