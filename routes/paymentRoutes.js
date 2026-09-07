const express = require('express');
const router = express.Router();
const { initiatePayment, telebirrCallback } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

router.post('/checkout', protect, initiatePayment);
router.post('/callback', telebirrCallback);

module.exports = router;
