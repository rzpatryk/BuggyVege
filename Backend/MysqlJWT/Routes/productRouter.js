const express = require('express');
const multer = require('multer');
const productController = require('../Controllers/productController');
const authController = require('../Controllers/authController');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Publiczne endpointy (bez autoryzacji)
router.get('/products', productController.getAllProducts);
router.get('/products/:id', productController.getProduct);

// Zabezpieczone endpointy - tylko dla adminów
router.post('/AddProduct', 
  authController.protect, 
  authController.restrictTo('admin'), 
  upload.array('images', 4), 
  productController.addProduct
);

router.delete('/products/:id',
  authController.protect,
  authController.restrictTo('admin'),
  productController.deleteProduct
);

router.put('/products/:id',
  authController.protect,
  authController.restrictTo('admin'),
  upload.array('images', 4),
  productController.updateProduct
);

module.exports = router;