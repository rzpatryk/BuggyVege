const BaseAuthController = require('../BaseControllers/BaseAuthController');
const MongoAdapter = require('../Database/AuthAdapters/MongoAdapter');
const AuthService = require('../Services/authService');

class MongoSessionAuthController extends BaseAuthController {
    constructor() {
        const dbAdapter = new MongoAdapter();
        const authService = new AuthService(dbAdapter);
        super(authService);
    }
}

module.exports = MongoSessionAuthController;