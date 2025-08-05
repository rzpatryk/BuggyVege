const asyncErrorHandler = require('../Utils/asyncErrorHandler');
const CustomError = require('../Utils/CustomError');

class BaseProductController {
    constructor(productService) {
        this.productService = productService;
    }

    addProduct = asyncErrorHandler(async (req, res, next) => {
        try {
            const { name, descriptions, category, price, offerPrice } = req.body;
            
            // req.files jest uzupełnione przez multer w routerze
            const imagePaths = req.files ? req.files.map(file => file.path) : [];

            const product = await this.productService.createProduct({
                name,
                descriptions,
                category,
                price,
                offerPrice,
                images: imagePaths
            });

            res.status(201).json({ 
                status: 'success',
                message: 'Produkt zapisany', 
                data: { product }
            });
        } catch (error) {
            const customError = new CustomError(error.message, 400);
            return next(customError);
        }
    });

    getAllProducts = asyncErrorHandler(async (req, res, next) => {
        try {
            const products = await this.productService.getAllProducts();
            
            res.status(200).json({
                status: 'success',
                results: products.length,
                data: {
                    products
                }
            });
        } catch (error) {
            const customError = new CustomError(error.message, 500);
            return next(customError);
        }
    });

    getProduct = asyncErrorHandler(async (req, res, next) => {
        try {
            const product = await this.productService.getProductById(req.params.id);
            
            res.status(200).json({
                status: 'success',
                data: {
                    product
                }
            });
        } catch (error) {
            const customError = new CustomError(error.message, 404);
            return next(customError);
        }
    });

    getProductWithReviews = asyncErrorHandler(async (req, res, next) => {
        try {
            const product = await this.productService.getProductWithReviews(req.params.id);

            res.status(200).json({
                status: 'success',
                data: {
                    product
                }
            });
        } catch (error) {
            const customError = new CustomError(error.message, 404);
            return next(customError);
        }
    });

    deleteProduct = asyncErrorHandler(async (req, res, next) => {
        try {
            await this.productService.deleteProduct(req.params.id);
            
            res.status(204).json({
                status: 'success',
                data: null
            });
        } catch (error) {
            const customError = new CustomError(error.message, 404);
            return next(customError);
        }
    });

    updateProduct = asyncErrorHandler(async (req, res, next) => {
        try {
            const { name, descriptions, category, price, offerPrice } = req.body;
            
            const updateData = {
                name,
                descriptions,
                category,
                price,
                offerPrice
            };

            // Usuń undefined values
            Object.keys(updateData).forEach(key => 
                updateData[key] === undefined && delete updateData[key]
            );

            // Jeśli są nowe zdjęcia, zaktualizuj je
            if (req.files && req.files.length > 0) {
                updateData.images = req.files.map(file => file.path);
            }

            const product = await this.productService.updateProduct(req.params.id, updateData);
            
            res.status(200).json({
                status: 'success',
                data: {
                    product
                }
            });
        } catch (error) {
            const customError = new CustomError(error.message, 400);
            return next(customError);
        }
    });
}

module.exports = BaseProductController;