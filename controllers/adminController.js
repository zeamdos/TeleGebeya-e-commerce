const User = require('../models/user');
const Product = require('../models/Product');
const Order = require('../models/Order');

exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalSellers = await User.countDocuments({ role: 'seller' });
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ orderStatus: 'pending' });
    const lowStockProducts = await Product.countDocuments({ stock: { $lte: 5 } });

    const totalRevenue = await Order.aggregate([
      { $match: { paymentStatus: { $in: ['paid', 'pending'] } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const paidRevenue = await Order.aggregate([
      { $match: { $or: [{ paymentStatus: 'paid' }, { orderStatus: 'delivered' }] } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const recentOrders = await Order.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'fullName phone');

    const lowStockList = await Product.find({ stock: { $lte: 5 } })
      .sort({ stock: 1 })
      .limit(10);

    res.json({
      totalUsers,
      totalSellers,
      totalProducts,
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      revenue: paidRevenue[0]?.total || 0,
      users: totalUsers,
      sellers: totalSellers,
      products: totalProducts,
      orders: totalOrders,
      pendingOrders,
      lowStock: lowStockProducts,
      recentOrders,
      lowStockProducts: lowStockList
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllOrdersAdmin = async (req, res) => {
  try {
    const orders = await Order.find({})
      .sort({ createdAt: -1 })
      .populate('user', 'fullName phone role')
      .populate('items.product');
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateOrderAdmin = async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!order) return res.status(404).json({ message: 'ትእዛዙ አልተገኘም።' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    const { role, shopName, telegramHandle } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (role && ['buyer', 'seller', 'admin'].includes(role)) {
      user.role = role;
    }
    if (shopName !== undefined) user.shopName = shopName;
    if (telegramHandle !== undefined) user.telegramHandle = telegramHandle;
    const updated = await user.save();
    res.json({
      id: updated._id,
      fullName: updated.fullName,
      phone: updated.phone,
      role: updated.role,
      shopName: updated.shopName,
      telegramHandle: updated.telegramHandle
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.adminUpdateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.adminDeleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.seedAdminUser = async () => {
  try {
    const bcrypt = require('bcryptjs');
    const adminPhone = 'admin0000';
    const existing = await User.findOne({ phone: adminPhone });
    if (existing) return;

    const hashed = await bcrypt.hash('Admin@1234', 10);
    const admin = new User({
      fullName: 'TeleGebeya Admin',
      phone: adminPhone,
      password: hashed,
      role: 'admin',
      shopName: 'TeleGebeya HQ',
      telegramHandle: '@telegebeya_admin'
    });
    await admin.save();
    console.log('Admin user seeded: phone=admin0000, password=Admin@1234');
  } catch (e) {
    console.error('Admin seed error:', e.message);
  }
};
