const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Produkt jest wymagany']
    },
    quantity: {
        type: Number,
        required: [true, 'Ilość jest wymagana'],
        min: [1, 'Ilość musi być większa od 0']
    },
    price: {
        type: Number,
        required: [true, 'Cena jest wymagana'],
        min: [0, 'Cena nie może być ujemna']
    },
    totalPrice: {
        type: Number,
        required: [true, 'Całkowita cena jest wymagana']
    }
});

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Zamówienie musi być przypisane do użytkownika']
    },
    orderNumber: {
        type: String,
        unique: true,
        required: true
    },
    items: [orderItemSchema],
    totalAmount: {
        type: Number,
        required: [true, 'Całkowita kwota jest wymagana'],
        min: [0, 'Całkowita kwota nie może być ujemna']
    },
    currency: {
        type: String,
        default: 'PLN'
    },
    status: {
        type: String,
        enum: ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['wallet', 'card', 'bank_transfer', 'blik'],
        required: [true, 'Metoda płatności jest wymagana']
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending'
    },
    // Adres dostawy
    shippingAddress: {
        street: String,
        city: String,
        postalCode: String,
        country: { type: String, default: 'Polska' }
    },
    // Powiązana transakcja
    transaction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
    },
    notes: String
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Generowanie numeru zamówienia przed zapisem
orderSchema.pre('save', async function(next) {
    if (!this.orderNumber) {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        // Znajdź ostatnie zamówienie z dzisiaj
        const lastOrder = await this.constructor.findOne({
            orderNumber: new RegExp(`^${year}${month}${day}`)
        }).sort({ orderNumber: -1 });
        
        let sequenceNumber = 1;
        if (lastOrder) {
            const lastSequence = parseInt(lastOrder.orderNumber.slice(-4));
            sequenceNumber = lastSequence + 1;
        }
        
        this.orderNumber = `${year}${month}${day}${String(sequenceNumber).padStart(4, '0')}`;
    }
    next();
});

// Indeksy
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });

// Middleware do populacji
orderSchema.pre(/^find/, function(next) {
    this.populate({
        path: 'user',
        select: 'name email'
    }).populate({
        path: 'items.product',
        select: 'name price images'
    });
    next();
});

module.exports = mongoose.model('Order', orderSchema);
