const ProductDatabaseAdapter = require('./ProductDatabaseAdapter');
const Product = require('../../Models/Product');

class MongoProductAdapter extends ProductDatabaseAdapter {
    async createProduct(productData) {
        const { name, descriptions, category, price, offerPrice, images } = productData;
        
        const product = await Product.create({
            name,
           descriptions: Array.isArray(descriptions)
            ? descriptions.map(s => s.trim())
            : descriptions.split(',').map(s => s.trim()),
            category,
            price: parseFloat(price),
            offerPrice: parseFloat(offerPrice),
            images
        });
        
        return product;
    }

    async getProductById(productId) {
        const product = await Product.findById(productId);
        return product;
    }

    async getAllProducts(filters = {}) {
        const products = await Product.find(filters);
        return products;
    }

    async updateProduct(productId, updateData) {
        const product = await Product.findByIdAndUpdate(
            productId, 
            updateData, 
            { new: true, runValidators: true }
        );
        return product;
    }

    async deleteProduct(productId) {
        const product = await Product.findByIdAndDelete(productId);
        return product;
    }

    async getProductWithReviews(productId) {
        const product = await Product.findById(productId)
            .populate({
                path: 'reviews',
                match: { status: 'approved' },
                options: { sort: { createdAt: -1 }, limit: 5 }
            });
        return product;
    }
}

module.exports = MongoProductAdapter;