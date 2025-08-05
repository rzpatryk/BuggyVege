const BaseWalletController = require('../../BaseControllers/BaseWalletController');
const MySQLWalletAdapter = require('../../Database/WalletAdapters/MySQLWalletAdapter');
const WalletService = require('../../Services/WalletService');

class MysqlSessionWalletController extends BaseWalletController {
    constructor() {
        const dbAdapter = new MySQLWalletAdapter(require('../../database').pool);
        const walletService = new WalletService(dbAdapter);
        super(walletService);
    }
}

module.exports = MysqlSessionWalletController;