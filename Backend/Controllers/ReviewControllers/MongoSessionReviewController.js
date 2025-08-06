const BaseReviewController = require('./BaseReviewController');
const MongoReviewAdapter = require('../../Database/ReviewAdapters/MongoReviewAdapter');
const ReviewService = require('../../Services/ReviewService');

class MongoSessionReviewController extends BaseReviewController {
    constructor() {
        const dbAdapter = new MongoReviewAdapter();
        const reviewService = new ReviewService(dbAdapter);
        super(reviewService);
    }
}

module.exports = MongoSessionReviewController;