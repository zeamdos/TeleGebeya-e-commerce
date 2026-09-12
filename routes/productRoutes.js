const express = require('express');
const router = express.Router();
const { getProducts, getProductById, createProduct, updateProduct, deleteProduct, getCategories, getMyProducts } = require('../controllers/productController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/categories', getCategories);
router.get('/seller/my-products', protect, getMyProducts);

router.route('/')
  .get(getProducts)
  .post(protect, createProduct); 

router.route('/:id')
  .get(getProductById)
  .put(protect, updateProduct)   
  .delete(protect, deleteProduct); 

module.exports = router;