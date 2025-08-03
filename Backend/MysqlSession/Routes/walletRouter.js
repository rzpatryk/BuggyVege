const express = require('express');
const walletController = require('../Controllers/walletController');
const authController = require('../Controllers/authController');

const router = express.Router();

// Wszystkie endpointy portfela wymagają autoryzacji
router.use(authController.protect);

// Endpointy portfela
router.get('/balance', walletController.getWalletBalance);
router.post('/deposit', walletController.depositToWallet);
router.get('/transactions', walletController.getTransactionHistory);

// Endpointy zakupów
router.post('/purchase', walletController.purchaseWithWallet);
router.get('/orders', walletController.getOrderHistory);
router.get('/orders/:orderId', walletController.getOrderDetails);
router.post('/refund', walletController.refundOrder);

module.exports = router;
