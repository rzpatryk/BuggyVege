const BaseProductController = require('../../BaseControllers/BaseProductController');
const MySQLProductAdapter = require('../../Database/ProductAdapters/MySQLProductAdapter');
const ProductService = require('../../Services/productService');

class MysqlSessionProductController extends BaseProductController {
    constructor() {
        const dbAdapter = new MySQLProductAdapter(require('../../database').pool);
        const productService = new ProductService(dbAdapter);
        super(productService);
    }
}

module.exports = MysqlSessionProductController;