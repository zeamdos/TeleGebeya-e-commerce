const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const Product = require('../models/Product');
const User = require('../models/user');
const { getProducts, getProductById, createProduct, updateProduct, deleteProduct, getCategories, getMyProducts } = require('../controllers/productController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/categories', getCategories);
router.get('/seller/my-products', protect, getMyProducts);

router.route('/')
  .get(getProducts)
  .post(protect, createProduct);

router.post('/:id/waitlist', protect, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    if (!product.waitlist) product.waitlist = [];
    
    if (!product.waitlist.includes(req.user._id)) {
      product.waitlist.push(req.user._id);
      await product.save();
    }

    res.json({ message: 'Added to waitlist successfully', product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/restock', protect, async (req, res) => {
  try {
    const { additionalStock } = req.body;
    const product = await Product.findById(req.params.id).populate('waitlist');

    if (!product) return res.status(404).json({ message: 'Product not found' });

    product.stock = (product.stock || 0) + Number(additionalStock || 0);
    const notifiedUsers = [...(product.waitlist || [])];
    product.waitlist = []; // Reset waitlist after notifying

    await product.save();

    // Trigger Telegram notifications to waitlisted buyers
    const tgBot = req.app.get('bot');
    if (tgBot && notifiedUsers.length > 0) {
      for (const buyer of notifiedUsers) {
        if (buyer.telegramChatId) {
          const restockMsg = `<b>ITEM RESTOCKED!</b>\n\n` +
            `The item <b>${product.name || product.title}</b> is back in stock!\n` +
            `Hurry and place your order now!`;
          await tgBot.telegram.sendMessage(buyer.telegramChatId, restockMsg, { parse_mode: 'HTML' });
        }
      }
    }

    res.json({ message: `Restocked ${additionalStock} units successfully`, product });
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