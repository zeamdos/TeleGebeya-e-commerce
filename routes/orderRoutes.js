const express = require('express');
const router = express.Router();
const { createOrder, getMyOrders, getAllOrders, getOrderById } = require('../controllers/orderController');
const { protect, optionalProtect, admin } = require('../middleware/authMiddleware');

router.route('/')
  .post(optionalProtect, createOrder)
  .get(protect, admin, getAllOrders);

router.route('/myorders').get(protect, getMyOrders);
router.route('/:id').get(getOrderById);

module.exports = router;
