const ProductDatabaseAdapter = require('./ProductDatabaseAdapter');

class MySQLProductAdapter extends ProductDatabaseAdapter {
    constructor(pool) {
        super();
        this.pool = pool;
    }

    async createProduct(productData) {
        const { name, descriptions, category, price, offerPrice, images } = productData;
        
        const descriptionsString = descriptions.split(',').map(s => s.trim()).join(',');
        const imagesString = images.join(',');
        
        const [result] = await this.pool.execute(`
            INSERT INTO products (name, descriptions, category, price, offer_price, images)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [name, descriptionsString, category, parseFloat(price), parseFloat(offerPrice), imagesString]);
        
        return await this.getProductById(result.insertId);
    }

    async getProductById(productId) {
        const [products] = await this.pool.execute(`
            SELECT * FROM products WHERE id = ?
        `, [productId]);
        
        if (products[0]) {
            const product = products[0];
            product.descriptions = product.descriptions ? product.descriptions.split(',') : [];
            product.images = product.images ? product.images.split(',') : [];
        }
        
        return products[0] || null;
    }

    async getAllProducts(filters = {}) {
        let query = 'SELECT * FROM products';
        const params = [];
        
        if (filters.category) {
            query += ' WHERE category = ?';
            params.push(filters.category);
        }
        
        const [products] = await this.pool.execute(query, params);
        
        return products.map(product => ({
            ...product,
            descriptions: product.descriptions ? product.descriptions.split(',') : [],
            images: product.images ? product.images.split(',') : []
        }));
    }

    async updateProduct(productId, updateData) {
        const fields = [];
        const values = [];
        
        if (updateData.name !== undefined) {
            fields.push('name = ?');
            values.push(updateData.name);
        }
        
        if (updateData.descriptions !== undefined) {
            fields.push('descriptions = ?');
            values.push(updateData.descriptions.join(','));
        }
        
        if (updateData.category !== undefined) {
            fields.push('category = ?');
            values.push(updateData.category);
        }
        
        if (updateData.price !== undefined) {
            fields.push('price = ?');
            values.push(updateData.price);
        }
        
        if (updateData.offerPrice !== undefined) {
            fields.push('offer_price = ?');
            values.push(updateData.offerPrice);
        }
        
        if (updateData.images !== undefined) {
            fields.push('images = ?');
            values.push(updateData.images.join(','));
        }
        
        if (fields.length === 0) {
            return await this.getProductById(productId);
        }
        
        fields.push('updated_at = CURRENT_TIMESTAMP');
        const setClause = fields.join(', ');
        
        await this.pool.execute(`
            UPDATE products SET ${setClause} WHERE id = ?
        `, [...values, productId]);
        
        return await this.getProductById(productId);
    }

    async deleteProduct(productId) {
        const product = await this.getProductById(productId);
        
        if (product) {
            await this.pool.execute('DELETE FROM products WHERE id = ?', [productId]);
        }
        
        return product;
    }

    async getProductWithReviews(productId) {
        // Dla MySQL implementacja będzie bardziej złożona - potrzebne osobne zapytania
        const product = await this.getProductById(productId);
        
        if (!product) {
            return null;
        }
        
        // Pobierz opinie (zakładając tabelę reviews)
        const [reviews] = await this.pool.execute(`
            SELECT r.*, u.name as user_name 
            FROM reviews r 
            JOIN users u ON r.user_id = u.id 
            WHERE r.product_id = ? AND r.status = 'approved' 
            ORDER BY r.created_at DESC 
            LIMIT 5
        `, [productId]);
        
        product.reviews = reviews;
        return product;
    }
}

module.exports = MySQLProductAdapter;