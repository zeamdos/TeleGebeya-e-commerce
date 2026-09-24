const User = require('../models/user');
const Product = require('../models/Product');
const Order = require('../models/Order');

exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalSellers = await User.countDocuments({ role: 'seller' });
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ orderStatus: { $in: ['pending', 'confirmed', 'shipping'] } });
    const lowStockProducts = await Product.countDocuments({ stock: { $lte: 5 } });

    const totalRevenue = await Order.aggregate([
      { $match: { paymentStatus: { $in: ['paid', 'pending', 'Paid'] } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const paidRevenue = await Order.aggregate([
      { $match: { $or: [{ paymentStatus: 'paid' }, { paymentStatus: 'Paid' }, { orderStatus: 'delivered' }] } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const escrowHeld = await Order.aggregate([
      { $match: { escrowStatus: 'held', orderStatus: { $nin: ['cancelled', 'Canceled'] } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const commissionEarned = await Order.aggregate([
      { $match: { orderStatus: { $in: ['delivered', 'Delivered'] } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$commissionAmount', { $multiply: ['$totalAmount', 0.10] }] } } } }
    ]);

    const readyPayouts = await Order.aggregate([
      { $match: { payoutStatus: 'ready_for_payout' } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$sellerPayoutAmount', { $multiply: ['$totalAmount', 0.90] }] } } } }
    ]);

    const paidPayouts = await Order.aggregate([
      { $match: { payoutStatus: 'paid_to_seller' } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$sellerPayoutAmount', { $multiply: ['$totalAmount', 0.90] }] } } } }
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
      totalEscrowHeld: escrowHeld[0]?.total || 0,
      totalCommissionEarned: commissionEarned[0]?.total || 0,
      readyPayoutsAmount: readyPayouts[0]?.total || 0,
      paidPayoutsAmount: paidPayouts[0]?.total || 0,
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
      .populate('items.product')
      .populate('items.seller', 'fullName phone sellerTelebirr sellerCbeAccount shopName');
    
    // Frontend compatibility mapping
    const frontendOrders = orders.map(order => {
      const frontendOrder = order.toObject();
      frontendOrder.paymentStatus = frontendOrder.paymentStatus === 'verified' ? 'Paid' : 
                              frontendOrder.paymentStatus === 'receipt_submitted' ? 'Verification Pending' : 
                              frontendOrder.paymentStatus === 'awaiting_payment' ? 'pending' : frontendOrder.paymentStatus;
      frontendOrder.orderStatus = frontendOrder.orderStatus === 'confirmed' ? 'Accepted' :
                             frontendOrder.orderStatus === 'shipping' ? 'Shipped' :
                             frontendOrder.orderStatus === 'delivered' ? 'Delivered' :
                             frontendOrder.orderStatus === 'cancelled' ? 'Canceled' : frontendOrder.orderStatus;
      return frontendOrder;
    });
    
    res.json(frontendOrders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateOrderAdmin = async (req, res) => {
  try {
    const existing = await Order.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'ትእዛዙ አልተገኘም።' });

    const targetStatus = req.body.orderStatus || req.body.status;
    const { isCanceled, restoreOrderStock, notifySellersOfCancel } = require('../utils/orderCancellation');
    const wasAlreadyCancelled = isCanceled(existing.orderStatus);
    const isNewlyCancelled = isCanceled(targetStatus) && !wasAlreadyCancelled;
    const wasAlreadyDelivered = ['delivered', 'Delivered'].includes(existing.orderStatus);
    const isNewlyDelivered = targetStatus === 'delivered' && !wasAlreadyDelivered;

    const updates = { ...req.body };
    if (isNewlyDelivered) {
      updates.escrowStatus = 'released';
      if (existing.payoutStatus !== 'paid_to_seller') {
        updates.payoutStatus = 'ready_for_payout';
      }
      updates.paymentStatus = 'paid';
    } else if (isNewlyCancelled) {
      updates.escrowStatus = 'refunded';
      updates.payoutStatus = 'cancelled';
    }

    const order = await Order.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .populate('user', 'fullName phone role')
      .populate('items.product');

    if (isNewlyCancelled) {
      const bot = require('../bot');
      await restoreOrderStock(order, bot);
      await notifySellersOfCancel(order, bot);
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllPayoutsAdmin = async (req, res) => {
  try {
    const orders = await Order.find({
      orderStatus: { $in: ['delivered', 'Delivered', 'shipping', 'pending', 'confirmed'] },
      orderStatus: { $nin: ['cancelled', 'Canceled'] }
    })
      .sort({ createdAt: -1 })
      .populate('user', 'fullName phone')
      .populate('items.seller', 'fullName phone sellerTelebirr sellerCbeAccount sellerBankName shopName')
      .populate('items.product');

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.markPayoutPaidAdmin = async (req, res) => {
  try {
    const { reference } = req.body;
    const order = await Order.findById(req.params.id)
      .populate('items.seller')
      .populate('items.product');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.payoutStatus = 'paid_to_seller';
    order.payoutPaidAt = new Date();
    order.payoutReference = reference || `TXN-PAY-${Date.now().toString().slice(-6)}`;
    await order.save();

    // Notify seller via Telegram
    (async () => {
      try {
        const bot = require('../bot');
        const sellerIds = [...new Set(order.items.map(it => it.seller?._id || it.seller || it.product?.seller).filter(Boolean))];
        for (const sId of sellerIds) {
          const seller = await User.findById(sId).lean();
          if (seller && seller.telegramChatId && bot && bot.telegram) {
            const msg =
              `💰 <b>PAYOUT TRANSFERRED!</b>\n\n` +
              `Your payout of <b>${order.sellerPayoutAmount} ETB</b> for order <code>${order.orderNumber || order._id}</code> has been disbursed by TeleGebeya to your account.\n\n` +
              `<b>Transaction Reference:</b> <code>${order.payoutReference}</code>\n` +
              `<b>Platform Fee (10%):</b> ${order.commissionAmount} ETB\n` +
              `Thank you for selling on TeleGebeya!`;
            await bot.telegram.sendMessage(seller.telegramChatId, msg, { parse_mode: 'HTML' });
          }
        }
      } catch (err) {
        console.error('Payout notification failed:', err.message);
      }
    })();

    res.json({ message: 'Payout marked as transferred to seller', order });
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

      const adminPhone = process.env.ADMIN_PHONE;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPhone || !adminPassword) {
      console.error('ADMIN_PHONE or ADMIN_PASSWORD missing from .env — admin not created');
      return;
    }
   
    const existing = await User.findOne({ phone: adminPhone });
   if (existing) {
      console.log('Admin user already exists, skipping seed.');
      return;
    }

    const hashed = await bcrypt.hash(adminPassword, 10);
    const admin = new User({
      fullName: 'TeleGebeya Admin',
      phone: adminPhone,
      password: hashed,
      role: 'admin',
      shopName: 'TeleGebeya HQ',
      telegramHandle: '@telegebeya_admin'
    });
    await admin.save();
    console.log('Admin user seeded with phone from .env');
  } catch (e) {
    console.error('Admin seed error:', e.message);
  }
};
