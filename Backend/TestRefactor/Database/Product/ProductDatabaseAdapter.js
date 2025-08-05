class ProductDatabaseAdapter {
    async createProduct(productData) {
        throw new Error('Method must be implemented');
    }

    async getProductById(productId) {
        throw new Error('Method must be implemented');
    }

    async getAllProducts(filters = {}) {
        throw new Error('Method must be implemented');
    }

    async updateProduct(productId, updateData) {
        throw new Error('Method must be implemented');
    }

    async deleteProduct(productId) {
        throw new Error('Method must be implemented');
    }

    async getProductWithReviews(productId) {
        throw new Error('Method must be implemented');
    }
}

module.exports = ProductDatabaseAdapter;