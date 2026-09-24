const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const User = require('../models/user');
const bot = require('../bot');
const {
  CANCELED,
  isCanceled,
  cancelOrder,
  notifySellersOfCancel,
  safeSend
} = require('../utils/orderCancellation');
const { 
  createOrder, 
  getMyOrders, 
  getOrderById, 
  updateOrderStatus,
  getSellerOrders
} = require('../controllers/orderController');

const { protect, optionalProtect, admin } = require('../middleware/authMiddleware');
const { canViewOrder, canModifyOrder, filterSensitiveData, logOrderAccess } = require('../middleware/orderOwnership');

// Apply logging and data filtering middleware
router.use(logOrderAccess);
router.use(filterSensitiveData);

router.route('/')
  .post(optionalProtect, createOrder)
  .get(protect, admin, async (req, res) => {
    try {
      const orders = await Order.find({})
        .sort({ createdAt: -1 })
        .populate('user', 'fullName phone role')
        .populate('items.product');
      res.json(orders);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

router.route('/myorders').get(protect, getMyOrders);
router.route('/seller/myorders').get(protect, getSellerOrders);
router.route('/:id/status').put(protect, canModifyOrder, updateOrderStatus);
router.route('/:id').get(canViewOrder, getOrderById);

// Legacy routes for backward compatibility - these will be deprecated
router.post('/', async (req, res) => {
  try {
    const { user, items, totalAmount, shippingAddress, phone, notes } = req.body;

    const newOrder = new Order({ user, items, totalAmount, shippingAddress, phone, notes });
    const savedOrder = await newOrder.save();

    const seller = await User.findOne({ role: 'seller' }); 

    if (seller && seller.telegramChatId) {
      const alertMsg = `<b>NEW ORDER RECEIVED!</b>\n\n` +
        `<b>Order ID:</b> <code>${savedOrder._id}</code>\n` +
        `<b>Total:</b> ${totalAmount} ETB\n` +
        `<b>Customer Phone:</b> ${phone}\n` +
        `<b>Address:</b> ${shippingAddress}\n` +
        `<b>Notes:</b> ${notes || 'None'}`;

      await bot.telegram.sendMessage(seller.telegramChatId, alertMsg, { parse_mode: 'HTML' });
    }

    res.status(201).json({ success: true, order: savedOrder });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Order creation failed' });
  }
});

// Update Order Status (Accepted, Shipping, Delivered, Canceled) - Legacy route
router.patch('/:id/status', async (req, res) => {
  try {
    const { orderStatus } = req.body;
    const canceling = isCanceled(orderStatus);
    console.log('[status] id:', req.params.id, '| received:', JSON.stringify(orderStatus), '| treated as cancel:', canceling);

    // Cancel  -> flips the status once and puts the items back in stock (utils/orderCancellation.js)
    // Anything else -> normal update, but a canceled order can't be brought back to life
    const order = canceling
      ? await cancelOrder(req.params.id, { status: orderStatus })
      : await Order.findOneAndUpdate(
          { _id: req.params.id, orderStatus: { $nin: CANCELED } },
          { orderStatus },
          { new: true }
        )
          .populate('user')
          .populate('items.product'); // was 'item.product' (typo)

    if (!order) {
      const existing = await Order.findById(req.params.id);
      if (!existing) return res.status(404).json({ message: 'Order not found' });

      // Order is already canceled: a repeat cancel is harmless, anything else is blocked
      return canceling
        ? res.json({ message: 'Order was already canceled', order: existing })
        : res.status(409).json({ message: 'This order is canceled and cannot be changed' });
    }

    const buyerTelegramId = order.user?.telegramChatId || order.buyerTelegramChatId;

    // Send Telegram Notification based on status
    if (buyerTelegramId) {
      let statusMessage = '';

      switch (orderStatus) {
        case 'Accepted':
          statusMessage = `✅ <b>Order Accepted!</b>\n\nYour order <code>#${order._id}</code> has been accepted by the seller and is being processed.`;
          break;
        case 'shipping':
        case 'Shipped':
          statusMessage = `🚚 <b>Order Shipped!</b>\n\nYour order <code>#${order._id}</code> is on its way to your delivery address.`;
          break;
        case 'delivered':
        case 'Delivered':
          statusMessage = `🎉 <b>Order Delivered!</b>\n\nYour order <code>#${order._id}</code> has been delivered. Thank you for shopping with TeleGebeya!`;
          break;
        case 'cancelled':
        case 'Canceled':
          statusMessage = `❌ <b>Order Canceled</b>\n\nYour order <code>#${order._id}</code> has been canceled. Please contact seller support for details.`;
          break;
        default:
          statusMessage = `📦 <b>Order Status Update</b>\n\nOrder <code>#${order._id}</code> status changed to: <b>${orderStatus}</b>`;
      }

      await safeSend(bot, buyerTelegramId, statusMessage);
    }

    if (canceling) {
      // Seller gets a dedicated "order canceled" alert listing the items that went back to stock
      await notifySellersOfCancel(order, bot);
    } else {
      const firstProduct = order.items?.[0]?.product;
      const seller = firstProduct ? await User.findById(firstProduct.seller || firstProduct.sellerId) : null;
      if (seller && seller.telegramChatId) {
        const sellerAlert = `<b>ORDER UPDATE ALERTS</b>\n\n` +
          `<b>Order ID:</b> <code>#${order._id}</code>\n` +
          `<b>New Status:</b> ${orderStatus}\n` +
          `<b>Customer Phone:</b> ${order.phone}`;
        await safeSend(bot, seller.telegramChatId, sellerAlert);
      }
    }

    res.json({ message: `Order status updated to ${orderStatus}`, order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Legacy payment verification route - will be deprecated
router.patch('/:id/verify-payment', async (req, res) => {
  try {
    const { action } = req.body; // 'approve' or 'reject'
    const isApproved = action === 'approve';

    const order = isApproved
      ? await Order.findOneAndUpdate(
          { _id: req.params.id, orderStatus: { $nin: CANCELED } }, // can't approve a canceled order
          { paymentStatus: 'Paid', orderStatus: 'Accepted' },
          { new: true }
        ).populate('user')
      // Rejecting the payment cancels the order, so the stock goes back too
      : await cancelOrder(req.params.id, { extra: { paymentStatus: 'Rejected' } });

    if (!order) {
      return res.status(409).json({ message: 'Order not found or already canceled' });
    }

    // Notify Buyer via Telegram Bot
    const buyerTelegramId = order.user?.telegramChatId || order.buyerTelegramChatId;
    if (buyerTelegramId) {
      const msg = isApproved 
        ? `✅ <b>Payment Approved!</b>\nYour order <code>#${order._id}</code> has been accepted and is being prepared.`
        : `❌ <b>Payment Rejected.</b>\nVerification failed for order <code>#${order._id}</code>. Please contact seller support.`;
      
      await safeSend(bot, buyerTelegramId, msg);
    }

    res.json({ message: `Payment ${action}d successfully`, order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;