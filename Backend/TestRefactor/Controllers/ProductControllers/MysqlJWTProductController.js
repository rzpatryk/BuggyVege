const BaseProductController = require('../BaseControllers/BaseProductController');
const MySQLProductAdapter = require('../Database/ProductAdapters/MySQLProductAdapter');
const ProductService = require('../Services/productService');

class MysqlJWTProductController extends BaseProductController {
    constructor() {
        const dbAdapter = new MySQLProductAdapter(require('../../database').pool);
        const productService = new ProductService(dbAdapter);
        super(productService);
    }
}

module.exports = MysqlJWTProductController;