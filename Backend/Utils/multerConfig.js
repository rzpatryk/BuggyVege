const multer = require('multer');
const path = require('path');
const CustomError = require('./CustomError');

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
    uploadReviewImages: reviewUpload.array('images', 5)
};