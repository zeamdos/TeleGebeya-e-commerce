const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const Product = require('../models/Product');
const User = require('../models/user');
const { getProducts, getProductById, createProduct, updateProduct, deleteProduct, getCategories, getMyProducts } = require('../controllers/productController');
const { protect, admin } = require('../middleware/authMiddleware');
const { optionalProtect } = require('../middleware/authMiddleware');

router.get('/categories', getCategories);
router.get('/seller/my-products', protect, getMyProducts);

router.route('/')
  .get(getProducts)
  .post(protect, createProduct);

router.post('/:id/waitlist', optionalProtect, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    if (!Array.isArray(product.waitlist)) product.waitlist = [];

    const userId = req.user ? (req.user.id || req.user._id) : undefined;
    const phone = req.body.phone || (req.user ? req.user.phone : '');
    const name = req.body.name || (req.user ? req.user.fullName : 'Customer');
    const selectedColor = req.body.selectedColor || '';

    if (!userId && !phone) {
      return res.status(400).json({ message: 'Please provide a phone number or sign in to join the waitlist.' });
    }

    const alreadyJoined = product.waitlist.some(entry => {
      if (userId && entry.user && String(entry.user) === String(userId)) return true;
      if (phone && entry.phone && String(entry.phone).replace(/\D/g, '').slice(-9) === String(phone).replace(/\D/g, '').slice(-9)) return true;
      return false;
    });

    if (alreadyJoined) {
      return res.status(200).json({
        message: 'You are already on the waitlist for this product.',
        onWaitlist: true,
        waitlistCount: product.waitlist.length
      });
    }

    product.waitlist.push({
      user: userId,
      phone,
      name,
      selectedColor,
      createdAt: new Date()
    });

    await product.save();

    res.status(200).json({
      message: 'Added to waitlist successfully!',
      onWaitlist: true,
      waitlistCount: product.waitlist.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/restock', protect, async (req, res) => {
  try {
    const { additionalStock } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) return res.status(404).json({ message: 'Product not found' });

    const prevStock = Number(product.stock) || 0;
    const addQty = Math.max(1, Number(additionalStock || 0));
    product.stock = prevStock + addQty;

    if (Array.isArray(product.colors) && product.colors.length > 0) {
      product.colors[0].stock = (Number(product.colors[0].stock) || 0) + addQty;
      product.stock = product.colors.reduce((sum, c) => sum + Math.max(0, Number(c.stock || 0)), 0);
    }

    await product.save();

    const { notifyWaitlistedUsers } = require('../utils/orderCancellation');
    const bot = require('../bot');
    await notifyWaitlistedUsers(product, bot);

    res.json({ message: `Restocked ${addQty} units successfully`, product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.route('/:id')
  .get(getProductById)
  .put(protect, updateProduct)   
  .delete(protect, deleteProduct); 
  router.post('/create', upload.single('image'), async (req, res) => {
  try {
    const imageUrl = req.file ? req.file.path : ''; 

    const newProduct = new Product({
      title: req.body.title,
      price: req.body.price,
      colors: JSON.parse(req.body.colors || '[]'),
      image: imageUrl, 
      seller: req.user._id
    });

    await newProduct.save();
    res.status(201).json({ message: 'Product created!', product: newProduct });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;