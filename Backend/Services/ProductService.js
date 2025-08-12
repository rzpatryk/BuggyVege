class ProductService {
    constructor(dbAdapter) {
        this.db = dbAdapter;
    }

    async createProduct(productData) {
        console.log('Creating product with data:', productData);
        const { name, descriptions, category, price, offerPrice, images } = productData;
        
        // Walidacja
        if (!name || !descriptions || !category || !price) {
            throw new Error('Nazwa, opisy, kategoria i cena są wymagane');
        }

        if (parseFloat(price) <= 0) {
            throw new Error('Cena musi być większa od 0');
        }

        if (offerPrice && parseFloat(offerPrice) < 0) {
            throw new Error('Cena promocyjna nie może być ujemna');
        }

        const product = await this.db.createProduct({
            name,
            descriptions,
            category,
            price,
            offerPrice: offerPrice || price,
            images: images || []
        });
        //console.log(product);
        return product;
    }

    async getProductById(productId) {
        if (!productId) {
            throw new Error('ID produktu jest wymagane');
        }

        const product = await this.db.getProductById(productId);
        
        if (!product) {
            throw new Error('Produkt nie został znaleziony');
        }

        return product;
    }

    async getAllProducts(filters = {}) {
        const products = await this.db.getAllProducts(filters);
        return products;
    }

    async updateProduct(productId, updateData) {
        if (!productId) {
            throw new Error('ID produktu jest wymagane');
        }

        // Sprawdź czy produkt istnieje
        const existingProduct = await this.db.getProductById(productId);
        if (!existingProduct) {
            throw new Error('Produkt nie został znaleziony');
        }

        // Przygotuj dane do aktualizacji
        const cleanUpdateData = {};
        
        if (updateData.name !== undefined) {
            cleanUpdateData.name = updateData.name;
        }
        
        if (updateData.descriptions !== undefined) {
            cleanUpdateData.descriptions = typeof updateData.descriptions === 'string' 
                ? updateData.descriptions.split(',').map(s => s.trim())
                : updateData.descriptions;
        }
        
        if (updateData.category !== undefined) {
            cleanUpdateData.category = updateData.category;
        }
        
        if (updateData.price !== undefined) {
            const price = parseFloat(updateData.price);
            if (price <= 0) {
                throw new Error('Cena musi być większa od 0');
            }
            cleanUpdateData.price = price;
        }
        
        if (updateData.offerPrice !== undefined) {
            const offerPrice = parseFloat(updateData.offerPrice);
            if (offerPrice < 0) {
                throw new Error('Cena promocyjna nie może być ujemna');
            }
            cleanUpdateData.offerPrice = offerPrice;
        }
        
        if (updateData.images !== undefined) {
            cleanUpdateData.images = updateData.images;
        }

        const updatedProduct = await this.db.updateProduct(productId, cleanUpdateData);
        return updatedProduct;
    }

    async deleteProduct(productId) {
        if (!productId) {
            throw new Error('ID produktu jest wymagane');
        }

        const product = await this.db.deleteProduct(productId);
        
        if (!product) {
            throw new Error('Produkt nie został znaleziony');
        }

        return product;
    }

    async getProductWithReviews(productId) {
        if (!productId) {
            throw new Error('ID produktu jest wymagane');
        }

        const product = await this.db.getProductWithReviews(productId);
        
        if (!product) {
            throw new Error('Produkt o podanym ID nie istnieje');
        }

        return product;
    }
}

module.exports = ProductService;