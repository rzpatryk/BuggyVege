const BaseWalletController = require('../../BaseControllers/BaseWalletController');
const MongoWalletAdapter = require('../../Database/WalletAdapters/MongoWalletAdapter');
const WalletService = require('../../Services/WalletService');

class MongoSessionWalletController extends BaseWalletController {
    constructor() {
        const dbAdapter = new MongoWalletAdapter();
        const walletService = new WalletService(dbAdapter);
        super(walletService);
    }
}

module.exports = MongoSessionWalletController;