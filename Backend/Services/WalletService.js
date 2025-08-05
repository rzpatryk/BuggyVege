class WalletService {
    constructor(dbAdapter) {
        this.db = dbAdapter;
    }

    async getWalletBalance(userId) {
        if (!userId) {
            throw new Error('ID użytkownika jest wymagane');
        }

        const wallet = await this.db.getUserWallet(userId);
        if (!wallet) {
            throw new Error('Użytkownik nie istnieje');
        }

        return wallet;
    }

    async depositToWallet(userId, depositData) {
        const { amount, paymentMethod, description } = depositData;

        // Walidacja
        if (!amount || amount <= 0) {
            throw new Error('Kwota musi być większa od 0');
        }

        if (amount > 10000) {
            throw new Error('Maksymalna kwota doładowania to 10,000 PLN');
        }

        const user = await this.db.getUserById(userId);
        if (!user) {
            throw new Error('Użytkownik nie istnieje');
        }

        const currentBalance = user.wallet.balance;
        const newBalance = currentBalance + amount;

        // Aktualizuj saldo
        await this.db.updateUserBalance(userId, newBalance);

        // Utwórz transakcję
        const transaction = await this.db.createTransaction({
            user: userId,
            type: 'deposit',
            amount: amount,
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            description: description || 'Doładowanie portfela',
            status: 'completed',
            metadata: {
                paymentMethod: paymentMethod || 'unknown'
            }
        });

        return {
            transaction,
            newBalance
        };
    }

    async getTransactionHistory(userId, filters = {}) {
        if (!userId) {
            throw new Error('ID użytkownika jest wymagane');
        }

        const transactions = await this.db.getTransactionHistory(userId, filters);
        const total = await this.db.getTransactionCount(userId, filters);

        return {
            transactions,
            total
        };
    }

    async purchaseWithWallet(userId, purchaseData) {
        const { items, shippingAddress } = purchaseData;

        // Walidacja
        if (!items || !Array.isArray(items) || items.length === 0) {
            throw new Error('Lista produktów jest wymagana');
        }

        if (!shippingAddress) {
            throw new Error('Adres dostawy jest wymagany');
        }

        const requiredFields = ['street', 'city', 'postalCode', 'country'];
        for (const field of requiredFields) {
            if (!shippingAddress[field]) {
                throw new Error(`Pole ${field} w adresie dostawy jest wymagane`);
            }
        }

        const user = await this.db.getUserById(userId);
        if (!user) {
            throw new Error('Użytkownik nie istnieje');
        }

        // Pobierz produkty i oblicz cenę
        let totalAmount = 0;
        const orderItems = [];

        for (const item of items) {
            if (!item.productId || !item.quantity) {
                throw new Error('ProductId i quantity są wymagane dla każdego produktu');
            }

            if (item.quantity <= 0) {
                throw new Error('Ilość musi być większa od 0');
            }

            const product = await this.db.getProductById(item.productId);
            if (!product) {
                throw new Error(`Produkt o ID ${item.productId} nie istnieje`);
            }

            const price = Math.min(product.price, product.offerPrice || product.price);
            const itemTotal = price * item.quantity;
            totalAmount += itemTotal;

            orderItems.push({
                product: product.id || product._id,
                quantity: item.quantity,
                price: price,
                totalPrice: itemTotal
            });
        }

        // Sprawdź saldo portfela
        const currentBalance = user.wallet.balance;
        if (currentBalance < totalAmount) {
            throw new Error(`Niewystarczające środki. Potrzebujesz ${totalAmount.toFixed(2)} PLN, masz ${currentBalance.toFixed(2)} PLN`);
        }

        // Oblicz nowe saldo
        const newBalance = currentBalance - totalAmount;

        // Aktualizuj saldo użytkownika
        await this.db.updateUserBalance(userId, newBalance);

        // Utwórz zamówienie
        const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const order = await this.db.createOrder({
            orderNumber,
            user: userId,
            items: orderItems,
            totalAmount,
            shippingAddress,
            paymentMethod: 'wallet',
            status: 'pending'
        });

        // Utwórz transakcję płatności
        const transaction = await this.db.createTransaction({
            user: userId,
            type: 'payment',
            amount: totalAmount,
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            description: `Zakup - zamówienie ${orderNumber}`,
            status: 'completed',
            relatedOrder: order.id || order._id,
            metadata: {
                orderNumber,
                itemCount: items.length,
                paymentMethod: 'wallet'
            }
        });

        return {
            order,
            transaction,
            newBalance
        };
    }

    async getOrderHistory(userId, filters = {}) {
        if (!userId) {
            throw new Error('ID użytkownika jest wymagane');
        }

        const orders = await this.db.getOrderHistory(userId, filters);
        const total = await this.db.getOrderCount(userId);

        return {
            orders,
            total
        };
    }

    async getOrderDetails(userId, orderId) {
        if (!userId || !orderId) {
            throw new Error('ID użytkownika i zamówienia są wymagane');
        }

        const order = await this.db.getOrderById(orderId, userId);
        if (!order) {
            throw new Error('Zamówienie nie istnieje');
        }

        return order;
    }

    async refundOrder(userId, refundData) {
        const { orderId, reason } = refundData;

        if (!orderId || !reason) {
            throw new Error('ID zamówienia i powód zwrotu są wymagane');
        }

        const order = await this.db.getOrderById(orderId, userId);
        if (!order) {
            throw new Error('Zamówienie nie istnieje');
        }

        if (order.status === 'refunded') {
            throw new Error('Zamówienie zostało już zwrócone');
        }

        if (order.status !== 'delivered') {
            throw new Error('Można zwrócić tylko dostarczone zamówienia');
        }

        const user = await this.db.getUserById(userId);
        const refundAmount = order.totalAmount || order.total_amount;
        const newBalance = user.wallet.balance + refundAmount;

        // Aktualizuj saldo użytkownika
        await this.db.updateUserBalance(userId, newBalance);

        // Aktualizuj status zamówienia
        await this.db.updateOrderStatus(orderId, 'refunded', {
            refundReason: reason,
            refundDate: new Date()
        });

        // Utwórz transakcję zwrotu
        const transaction = await this.db.createTransaction({
            user: userId,
            type: 'refund',
            amount: refundAmount,
            balanceBefore: user.wallet.balance,
            balanceAfter: newBalance,
            description: `Zwrot za zamówienie ${order.orderNumber || order.order_number}`,
            status: 'completed',
            relatedOrder: order.id || order._id,
            metadata: {
                refundReason: reason,
                originalOrderNumber: order.orderNumber || order.order_number
            }
        });

        return {
            refundAmount,
            newBalance,
            transaction
        };
    }
}

module.exports = WalletService;