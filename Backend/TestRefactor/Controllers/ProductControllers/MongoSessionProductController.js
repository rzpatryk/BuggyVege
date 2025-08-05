const BaseProductController = require('../BaseControllers/BaseProductController');
const MongoProductAdapter = require('../Database/ProductAdapters/MongoProductAdapter');
const ProductService = require('../Services/productService');

class MongoSessionProductController extends BaseProductController {
    constructor() {
        const dbAdapter = new MongoProductAdapter();
        const productService = new ProductService(dbAdapter);
        super(productService);
    }
}

module.exports = MongoSessionProductController;