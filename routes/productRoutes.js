const express = require('express');
const router = express.Router();
const { getProducts, getProductById, createProduct, updateProduct, deleteProduct } = require('../controllers/productController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
  .get(getProducts)
  .post(protect, createProduct); 

router.route('/:id')
  .get(getProductById)
  .put(protect, updateProduct)   
  .delete(protect, admin, deleteProduct); 

module.exports = router;