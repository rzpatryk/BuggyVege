const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Transakcja musi być przypisana do użytkownika']
    },
    type: {
        type: String,
        enum: ['deposit', 'payment', 'refund'],
        required: [true, 'Typ transakcji jest wymagany']
    },
    amount: {
        type: Number,
        required: [true, 'Kwota transakcji jest wymagana'],
        min: [0.01, 'Kwota musi być większa od 0']
    },
    currency: {
        type: String,
        default: 'PLN'
    },
    description: {
        type: String,
        required: [true, 'Opis transakcji jest wymagany']
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'cancelled'],
        default: 'completed'
    },
    // Powiązane z zakupem produktu (jeśli dotyczy)
    relatedOrder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },
    // Saldo przed i po transakcji
    balanceBefore: {
        type: Number,
        required: true
    },
    balanceAfter: {
        type: Number,
        required: true
    },
    // Metadane transakcji
    metadata: {
        paymentMethod: String, // 'card', 'bank_transfer', 'blik', etc.
        externalTransactionId: String,
        ipAddress: String
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indeksy dla wydajności
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ status: 1 });

// Virtual dla formatowania daty
transactionSchema.virtual('formattedDate').get(function() {
    return this.createdAt.toLocaleDateString('pl-PL');
});

// Middleware do populacji użytkownika
transactionSchema.pre(/^find/, function(next) {
    this.populate({
        path: 'user',
        select: 'name email'
    });
    next();
});

module.exports = mongoose.model('Transaction', transactionSchema);
