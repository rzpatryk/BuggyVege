const BaseReviewController = require('./BaseReviewController');
const MySQLReviewAdapter = require('../../Database/ReviewAdapters/MySQLReviewAdapter');
const ReviewService = require('../../Services/ReviewService');

class MysqlSessionReviewController extends BaseReviewController {
    constructor() {
        const dbAdapter = new MySQLReviewAdapter(require('../../database').pool);
        const reviewService = new ReviewService(dbAdapter);
        super(reviewService);
    }
}

module.exports = MysqlSessionReviewController;