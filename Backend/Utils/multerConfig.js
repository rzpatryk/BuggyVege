const multer = require('multer');
const path = require('path');
const CustomError = require('./CustomError');

// Konfiguracja dla zdjęć produktów
const productStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/products/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const productUpload = multer({
    storage: productStorage,
    limits: {
        fileSize: 20 * 1024 * 1024,
        files: 5
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new CustomError('Dozwolone są tylko pliki obrazków', 400), false);
        }
    }
});
// Konfiguracja dla zdjęć opinii
const reviewStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/reviews/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'review-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const reviewUpload = multer({
    storage: reviewStorage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 5 // Maksymalnie 5 zdjęć
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new CustomError('Dozwolone są tylko pliki obrazków', 400), false);
        }
    }
});

module.exports = {
    uploadReviewImages: reviewUpload.array('images', 5),
    uploadProductImages: productUpload.array('images', 5)
};