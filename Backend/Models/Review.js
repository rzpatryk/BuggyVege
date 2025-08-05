const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Opinia musi mieć przypisanego użytkownika']
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Opinia musi dotyczyć produktu']
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: [true, 'Można oceniać tylko zakupione produkty']
    },
    rating: {
        type: Number,
        required: [true, 'Ocena jest wymagana'],
        min: [1, 'Ocena musi być co najmniej 1'],
        max: [5, 'Ocena nie może być wyższa niż 5'],
        validate: {
            validator: function(val) {
                return Number.isInteger(val);
            },
            message: 'Ocena musi być liczbą całkowitą'
        }
    },
    title: {
        type: String,
        required: [true, 'Tytuł opinii jest wymagany'],
        trim: true,
        maxlength: [100, 'Tytuł nie może być dłuższy niż 100 znaków']
    },
    comment: {
        type: String,
        required: [true, 'Treść opinii jest wymagana'],
        trim: true,
        maxlength: [1000, 'Opinia nie może być dłuższa niż 1000 znaków'],
        minlength: [10, 'Opinia musi mieć co najmniej 10 znaków']
    },
    pros: [{
        type: String,
        trim: true,
        maxlength: [200, 'Zaleta nie może być dłuższa niż 200 znaków']
    }],
    cons: [{
        type: String,
        trim: true,
        maxlength: [200, 'Wada nie może być dłuższa niż 200 znaków']
    }],
    images: [{
        type: String,
        validate: {
            validator: function(val) {
                return /\.(jpg|jpeg|png|gif)$/i.test(val);
            },
            message: 'Dozwolone są tylko pliki obrazków (jpg, jpeg, png, gif)'
        }
    }],
    helpfulVotes: {
        type: Number,
        default: 0,
        min: 0
    },
    verifiedPurchase: {
        type: Boolean,
        default: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    moderatorNote: {
        type: String,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indeksy dla wydajności
reviewSchema.index({ product: 1, rating: -1 });
reviewSchema.index({ user: 1, product: 1 }, { unique: true }); // Użytkownik może ocenić produkt tylko raz
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ status: 1 });

// Middleware do populowania danych użytkownika
reviewSchema.pre(/^find/, function(next) {
    this.populate({
        path: 'user',
        select: 'name photo'
    });
    next();
});

// Metoda statyczna do obliczania średniej oceny produktu
reviewSchema.statics.calcAverageRating = async function(productId) {
    const stats = await this.aggregate([
        {
            $match: { 
                product: productId,
                status: 'approved'
            }
        },
        {
            $group: {
                _id: '$product',
                numRatings: { $sum: 1 },
                avgRating: { $avg: '$rating' },
                ratingDistribution: {
                    $push: '$rating'
                }
            }
        }
    ]);

    if (stats.length > 0) {
        // Oblicz rozkład ocen (1-5 gwiazdek)
        const distribution = [0, 0, 0, 0, 0];
        stats[0].ratingDistribution.forEach(rating => {
            distribution[rating - 1]++;
        });

        await mongoose.model('Product').findByIdAndUpdate(productId, {
            ratingsQuantity: stats[0].numRatings,
            ratingsAverage: Math.round(stats[0].avgRating * 10) / 10,
            ratingDistribution: distribution
        });
    } else {
        await mongoose.model('Product').findByIdAndUpdate(productId, {
            ratingsQuantity: 0,
            ratingsAverage: 0,
            ratingDistribution: [0, 0, 0, 0, 0]
        });
    }
};

// Middleware do aktualizacji średniej oceny po zapisaniu
reviewSchema.post('save', function() {
    this.constructor.calcAverageRating(this.product);
});

// Middleware do aktualizacji średniej oceny po usunięciu
reviewSchema.post(/^findOneAnd/, async function(doc) {
    if (doc) {
        await doc.constructor.calcAverageRating(doc.product);
    }
});

// Virtual dla formatowania daty
reviewSchema.virtual('formattedDate').get(function() {
    return this.createdAt.toLocaleDateString('pl-PL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
});

module.exports = mongoose.model('Review', reviewSchema);