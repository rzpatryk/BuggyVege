const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: String,
  descriptions: [String],
  category: String,
  price: Number,
  offerPrice: Number,
  images: [String], // ścieżki do zdjęć
});

module.exports = mongoose.model('Product', productSchema);