const Product = require('../models/Product');
const { generateThumbnail } = require('../utils/imageThumbnail');

exports.getProducts = async (req, res) => {
  try {
    const { search, category, sort } = req.query;
    let query = {};

    if (category && category !== 'All') {
      query.category = { $regex: new RegExp(`^${category}$`, 'i') };
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: regex },
        { description: regex },
        { category: regex },
        { sellerName: regex },
        { telegramHandle: regex }
      ];
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'price-asc') sortOption = { price: 1 };
    else if (sort === 'price-desc') sortOption = { price: -1 };
    else if (sort === 'rating') sortOption = { rating: -1 };

   const products = await Product.find(query).sort(sortOption);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMyProducts = async (req, res) => {
  try {
    const products = await Product.find({ seller: req.user.id }).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const normalizeVariantList = (value) => {
  const rawList = Array.isArray(value) ? value : [];
  const variants = rawList
    .map(item => ({
      name: String(item?.name || '').trim(),
      stock: Math.max(0, Number(item?.stock ?? 0))
    }))
    .filter(item => item.name);

  if (variants.length === 0 && value && value.name) {
    variants.push({
      name: String(value.name).trim(),
      stock: Math.max(0, Number(value.stock ?? 0))
    });
  }

  if (variants.length === 0) {
    const fallbackStock = typeof value === 'number' ? value : 25;
    return [{ name: 'Default', stock: Math.max(0, Number(fallbackStock)) }];
  }

  return variants;
};

const sumVariantStock = (colors) => {
  if (!Array.isArray(colors) || colors.length === 0) return 0;
  return colors.reduce((sum, item) => sum + Math.max(0, Number(item.stock ?? 0)), 0);
};

exports.createProduct = async (req, res) => {
  try {
    const normalizedColors = normalizeVariantList(req.body.colors ?? req.body.color ?? req.body.stock);
    const finalImageUrl = req.file ? req.file.path : (req.body.imageUrl || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80');
    const thumbnailUrl = await generateThumbnail(finalImageUrl);

    const payload = {
      ...req.body,
      seller: req.user ? req.user.id : undefined,
      sellerId: req.user ? req.user.id : undefined,
      sellerName: req.body.sellerName || (req.user ? (req.user.fullName || req.user.shopName) : 'TeleGebeya Seller'),
      sellerPhone: req.body.sellerPhone || (req.user ? req.user.phone : '0911223344'),
      telegramHandle: req.body.telegramHandle || (req.user?.telegramHandle ? req.user.telegramHandle : '@TeleGebeya_Shop_bot'),
      imageUrl: finalImageUrl,
      thumbnailUrl,
      colors: normalizedColors,
      color: normalizedColors[0]?.name || req.body.color || '',
      stock: typeof req.body.stock === 'number'
        ? Math.max(0, Number(req.body.stock))
        : sumVariantStock(normalizedColors) || 25,
    };
    const product = new Product(payload);
    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const existing = await Product.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const prevStock = Number(existing.stock) || 0;
    const normalizedColors = normalizeVariantList(req.body.colors ?? req.body.color ?? req.body.stock);
    const payload = {
      ...req.body,
      colors: normalizedColors,
      color: normalizedColors[0]?.name || req.body.color || '',
      stock: typeof req.body.stock === 'number'
        ? Math.max(0, Number(req.body.stock))
        : sumVariantStock(normalizedColors) || 25,
    };
    if (req.body.imageUrl && req.body.imageUrl !== existing.imageUrl) {
      payload.thumbnailUrl = await generateThumbnail(req.body.imageUrl);
    } else {
      delete payload.imageUrl;      // never blank out the existing image
      delete payload.thumbnailUrl;
    }

    const product = await Product.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (product) {
      if (prevStock === 0 && product.stock > 0) {
        const { notifyWaitlistedUsers } = require('../utils/orderCancellation');
        const bot = require('../bot');
        await notifyWaitlistedUsers(product, bot);
      }
      res.json(product);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (product) {
      res.json({ message: 'Product removed' });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};