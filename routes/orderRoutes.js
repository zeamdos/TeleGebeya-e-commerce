const express = require('express');
const router = express.Router();
const { createOrder, getMyOrders, getAllOrders } = require('../controllers/orderController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
  .post(protect, createOrder)
  .get(protect, admin, getAllOrders);

router.route('/myorders').get(protect, getMyOrders);

module.exports = router;
