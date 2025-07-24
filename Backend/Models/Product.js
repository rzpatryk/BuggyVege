const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: String,
  descriptions: [String],
  category: String,
  price: Number,
  offerPrice: Number,
  images: [String], // ścieżki do zdjęć
  ratingsAverage: {
    type: Number,
    default: 0,
    min: [0, 'Średnia ocena nie może być ujemna'],
    max: [5, 'Średnia ocena nie może być wyższa niż 5'],
    set: val => Math.round(val * 10) / 10
  },
  ratingsQuantity: {
    type: Number,
    default: 0,
    min: [0, 'Liczba ocen nie może być ujemna']
  },
  ratingDistribution: {
    type: [Number],
    default: [0, 0, 0, 0, 0] // [1-gwiazdka, 2-gwiazdki, 3-gwiazdki, 4-gwiazdki, 5-gwiazdek]
  }
});

// Virtual dla opinii
productSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'product',
  localField: '_id'
});

module.exports = mongoose.model('Product', productSchema);