const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const adminController = require('../controllers/adminController');

router.get('/stats', protect, admin, adminController.getDashboardStats);
router.get('/users', protect, admin, adminController.getAllUsers);
router.put('/users/:id/role', protect, admin, adminController.updateUserRole);
router.delete('/users/:id', protect, admin, adminController.deleteUser);
router.get('/products', protect, admin, adminController.adminUpdateProduct ? (req, res) => {
  const Product = require('../models/Product');
  Product.find({}).sort({ createdAt: -1 }).then(p => res.json(p)).catch(e => res.status(500).json({ message: e.message }));
} : (req, res) => res.status(500).json({ message: 'Products unavailable' }));
router.put('/products/:id', protect, admin, adminController.adminUpdateProduct);
router.delete('/products/:id', protect, admin, adminController.adminDeleteProduct);
router.get('/orders', protect, admin, adminController.getAllOrdersAdmin);
router.put('/orders/:id', protect, admin, adminController.updateOrderAdmin);

module.exports = router;
