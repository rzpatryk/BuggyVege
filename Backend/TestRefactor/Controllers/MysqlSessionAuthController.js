const BaseAuthController = require('../BaseControllers/BaseAuthController'); // Usuń duplikat
const MySQLAdapter = require('../Database/AuthAdapters/MySQLAdapter');
const AuthService = require('../Services/authService');
const { pool } = require('../../database');

class MysqlSessionAuthController extends BaseAuthController {
    constructor() {
        const dbAdapter = new MySQLAdapter(pool);
        const authService = new AuthService(dbAdapter);
        super(authService);
    }
}

module.exports = MysqlSessionAuthController;