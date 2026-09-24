const express = require('express');
const User = require('../models/user')
const router = express.Router();
const { 
  initiatePayment, 
  telebirrCallback, 
  uploadPaymentReceipt, 
  verifyPayment, 
  getPendingPayments,
  processPayout,
  getReadyPayouts
} = require('../controllers/paymentController');
const { protect, admin } = require('../middleware/authMiddleware');
const { canAccessPayment, canAccessPayout, filterSensitiveData, logOrderAccess } = require('../middleware/orderOwnership');

// Apply logging and data filtering middleware
router.use(logOrderAccess);
router.use(filterSensitiveData);

// Public/Protected routes
router.post('/checkout', protect, initiatePayment);
router.post('/upload-receipt', protect, canAccessPayment, uploadPaymentReceipt);
router.post('/callback', telebirrCallback);

// Admin only routes
router.post('/verify-payment', protect, admin, canAccessPayment, verifyPayment);
router.get('/pending-payments', protect, admin, getPendingPayments);
router.post('/process-payout', protect, admin, canAccessPayout, processPayout);
router.get('/ready-payouts', protect, admin, canAccessPayout, getReadyPayouts);

module.exports = router;
