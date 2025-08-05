const WalletDatabaseAdapter = require('./WalletDatabaseAdapter');

class MySQLWalletAdapter extends WalletDatabaseAdapter {
    constructor(pool) {
        super();
        this.pool = pool;
    }

    async getUserWallet(userId) {
        const [users] = await this.pool.execute(
            'SELECT id, wallet_balance, wallet_currency FROM users WHERE id = ?',
            [userId]
        );
        
        if (!users[0]) return null;
        
        return {
            id: users[0].id,
            balance: users[0].wallet_balance,
            currency: users[0].wallet_currency || 'PLN'
        };
    }

    async updateUserBalance(userId, newBalance) {
        await this.pool.execute(
            'UPDATE users SET wallet_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [newBalance, userId]
        );
        return newBalance;
    }

    async createTransaction(transactionData) {
        const { user, type, amount, balanceBefore, balanceAfter, description, status, relatedOrder, metadata } = transactionData;
        
        const [result] = await this.pool.execute(`
            INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, description, status, related_order_id, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            user, 
            type, 
            amount, 
            balanceBefore, 
            balanceAfter, 
            description, 
            status, 
            relatedOrder || null, 
            JSON.stringify(metadata || {})
        ]);

        return await this.getTransactionById(result.insertId);
    }

    async getTransactionById(transactionId) {
        const [transactions] = await this.pool.execute(
            'SELECT * FROM transactions WHERE id = ?',
            [transactionId]
        );
        
        if (transactions[0]) {
            const transaction = transactions[0];
            transaction.metadata = JSON.parse(transaction.metadata || '{}');
        }
        
        return transactions[0] || null;
    }

    async getTransactionHistory(userId, filters = {}) {
        const { page = 1, limit = 10, type } = filters;
        
        let query = 'SELECT * FROM transactions WHERE user_id = ?';
        const params = [userId];
        
        if (type) {
            query += ' AND type = ?';
            params.push(type);
        }
        
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), (page - 1) * parseInt(limit));
        
        const [transactions] = await this.pool.execute(query, params);
        
        return transactions.map(transaction => ({
            ...transaction,
            metadata: JSON.parse(transaction.metadata || '{}')
        }));
    }

    async getTransactionCount(userId, filters = {}) {
        let query = 'SELECT COUNT(*) as count FROM transactions WHERE user_id = ?';
        const params = [userId];
        
        if (filters.type) {
            query += ' AND type = ?';
            params.push(filters.type);
        }
        
        const [result] = await this.pool.execute(query, params);
        return result[0].count;
    }

    async createOrder(orderData) {
        const { 
            orderNumber, 
            user, 
            items, 
            totalAmount, 
            shippingAddress, 
            paymentMethod, 
            status 
        } = orderData;
        
        const [result] = await this.pool.execute(`
            INSERT INTO orders (order_number, user_id, total_amount, shipping_address, payment_method, status)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            orderNumber,
            user,
            totalAmount,
            JSON.stringify(shippingAddress),
            paymentMethod,
            status
        ]);
        
        const orderId = result.insertId;
        
        // Dodaj items do order_items
        for (const item of items) {
            await this.pool.execute(`
                INSERT INTO order_items (order_id, product_id, quantity, price, total_price)
                VALUES (?, ?, ?, ?, ?)
            `, [orderId, item.product, item.quantity, item.price, item.totalPrice]);
        }
        
        return await this.getOrderById(orderId, user);
    }

    async getOrderById(orderId, userId) {
        const [orders] = await this.pool.execute(`
            SELECT * FROM orders WHERE id = ? AND user_id = ?
        `, [orderId, userId]);
        
        if (!orders[0]) return null;
        
        const order = orders[0];
        order.shippingAddress = JSON.parse(order.shipping_address || '{}');
        
        // Pobierz items
        const [items] = await this.pool.execute(`
            SELECT oi.*, p.name, p.images, p.price as product_price
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `, [orderId]);
        
        order.items = items.map(item => ({
            product: {
                id: item.product_id,
                name: item.name,
                images: item.images ? item.images.split(',') : [],
                price: item.product_price
            },
            quantity: item.quantity,
            price: item.price,
            totalPrice: item.total_price
        }));
        
        return order;
    }

    async getOrderHistory(userId, filters = {}) {
        const { page = 1, limit = 10 } = filters;
        
        const [orders] = await this.pool.execute(`
            SELECT o.*, COUNT(oi.id) as item_count
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE o.user_id = ?
            GROUP BY o.id
            ORDER BY o.created_at DESC
            LIMIT ? OFFSET ?
        `, [userId, parseInt(limit), (page - 1) * parseInt(limit)]);
        
        return orders.map(order => ({
            ...order,
            shippingAddress: JSON.parse(order.shipping_address || '{}'),
            itemCount: order.item_count
        }));
    }

    async getOrderCount(userId) {
        const [result] = await this.pool.execute(
            'SELECT COUNT(*) as count FROM orders WHERE user_id = ?',
            [userId]
        );
        return result[0].count;
    }

    async updateOrderStatus(orderId, status, additionalData = {}) {
        const fields = ['status = ?'];
        const values = [status];
        
        if (additionalData.refundReason) {
            fields.push('refund_reason = ?');
            values.push(additionalData.refundReason);
        }
        
        if (additionalData.refundDate) {
            fields.push('refund_date = ?');
            values.push(additionalData.refundDate);
        }
        
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(orderId);
        
        await this.pool.execute(`
            UPDATE orders SET ${fields.join(', ')} WHERE id = ?
        `, values);
        
        return await this.getOrderById(orderId);
    }

    async getProductById(productId) {
        const [products] = await this.pool.execute(
            'SELECT * FROM products WHERE id = ?',
            [productId]
        );
        
        if (products[0]) {
            const product = products[0];
            product.descriptions = product.descriptions ? product.descriptions.split(',') : [];
            product.images = product.images ? product.images.split(',') : [];
        }
        
        return products[0] || null;
    }

    async getUserById(userId) {
        const [users] = await this.pool.execute(
            'SELECT id, name, email, wallet_balance, wallet_currency FROM users WHERE id = ?',
            [userId]
        );
        
        if (!users[0]) return null;
        
        return {
            id: users[0].id,
            name: users[0].name,
            email: users[0].email,
            wallet: {
                balance: users[0].wallet_balance,
                currency: users[0].wallet_currency || 'PLN'
            }
        };
    }
}

module.exports = MySQLWalletAdapter;