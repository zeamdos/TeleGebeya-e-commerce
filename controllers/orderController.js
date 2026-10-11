const Order = require('../models/Order');
const Product = require('../models/Product');
const mongoose = require('mongoose');
const User = require('../models/user');
const { transitionOrderState, canPerformOperation } = require('../utils/orderStateMachine');
const {
  isCanceled,
  restoreOrderStock,
  restoreProductStock,
  notifySellersOfCancel,
  notifyWaitlistedUsers
} = require('../utils/orderCancellation');

const AMHARIC_MESSAGES = {
  ORDER_CREATED: 'ትእዛዝዎ በተሳካ ሁኔታ ተልኳል።',
  NOT_FOUND: 'ትእዛዙ አልተገኘም።',
  NOT_AUTHORIZED: 'ይህን ትእዛዝ ለመመልከት ፈቃድ የለዎትም።',
  NO_ITEMS: 'ቅርጫትዎ ባዶ ነው - እባክዎ ቢያንስ አንድ እቃ ያክሉ።',
  INVALID_ITEMS: 'አንድ ወይም በላይ እቃዎች ስላልተገኙ ትእዛዙን መፍጠር አልተቻለም።',
  OUT_OF_STOCK_PREFIX: 'የክምችት እጥፍ፦ ',
  INSUFFICIENT_STOCK_1: 'የሚጠየቀው ብዛት የለም. ቀሪ',
  INSUFFICIENT_STOCK_2: 'ብቻ ነው።',
  SIMULTANEOUS: 'በተጋጣሚ የተደረገ ሽያጭ ምክንያት ክምችቱ አሁን ሊገኝ የማይችል ነው። እባክዎ ያገለገሉ እና እንደገና ይሞክሩ።',
  STATUS_UPDATED: 'የትእዛዝ ሁኔታ በተሳካ ሁኔታ ተሻሽሏል።',
};

const createOrderNumber = () => {
  return 'TG-' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
};

const normalizeColorName = (value = '') => String(value).trim().toLowerCase();

exports.createOrder = async (req, res) => {
  let session;

  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const {
      customerName,
      phone = req.user?.phone,
      subcity,
      streetAddress,
      houseNumber,
      shippingAddress,
      notes,
      items,
      totalAmount,
      paymentMethod = 'cash_on_delivery',
    } = req.body;

    const userId = req.user?.id || req.user?._id || req.body.userId;

    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: AMHARIC_MESSAGES.NO_ITEMS });
    }
  if (!phone || !subcity) {
  await session.abortTransaction();
  session.endSession();
  return res.status(400).json({ message: 'Phone number and subcity are required.' });
}
if (!streetAddress || !streetAddress.trim() || !houseNumber || !houseNumber.trim()) {
  await session.abortTransaction();
  session.endSession();
  return res.status(400).json({ message: 'Please provide your full delivery address (street and house number).' });
}

    const invalidProductIds = items
      .map(item => item?.product)
      .filter(productId => !productId || !mongoose.isValidObjectId(productId));
    if (invalidProductIds.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: 'One or more cart products are invalid. Please refresh your cart and try again.'
      });
    }

    if (userId && !mongoose.isValidObjectId(userId)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Your login session is invalid. Please sign in again.' });
    }

    const allowedPaymentMethods = ['telebirr', 'cash_on_delivery', 'cbe_birr'];
    if (!allowedPaymentMethods.includes(paymentMethod)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Please select a valid payment method.' });
    }

    const productIds = items.map(it => it.product).filter(Boolean);
    const products = await Product.find({ _id: { $in: productIds } }).session(session);
    const productMap = new Map(products.map(p => [String(p._id), p]));

    const missingIds = productIds.filter(id => !productMap.has(String(id)));
    if (missingIds.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: AMHARIC_MESSAGES.INVALID_ITEMS, missingIds });
    }

    const stockErrors = [];
    const normalizedItems = items.map(item => {
      const pid = String(item.product);
      const product = productMap.get(pid);
      const qty = Math.max(1, Math.floor(Number(item.quantity)) || 1);
      const colorName = item.selectedColor || product.color || (Array.isArray(product.colors) && product.colors[0]?.name) || '';
      const variant = Array.isArray(product.colors) && product.colors.length > 0
        ? product.colors.find(color => normalizeColorName(color.name) === normalizeColorName(colorName))
        : null;
      const available = variant ? Number(variant.stock) || 0 : Number(product.stock) || 0;
      if (available < qty) {
        stockErrors.push(
          `"${product.name}" ${AMHARIC_MESSAGES.INSUFFICIENT_STOCK_1} ${available} ${AMHARIC_MESSAGES.INSUFFICIENT_STOCK_2}`
        );
      }
      const price = Number(item.price ?? product.price ?? 0);
      if (!Number.isFinite(price) || price < 0) {
        throw new Error(`Invalid price for product ${product.name}`);
      }

      return {
        product: pid,
        name: item.name || product.name,
        imageUrl: item.imageUrl || product.imageUrl,
        quantity: qty,
        price,
        selectedColor: colorName,
        seller: product.sellerId || product.seller || null,
      };
    });

    if (stockErrors.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({
        message: AMHARIC_MESSAGES.OUT_OF_STOCK_PREFIX + stockErrors.join(' | '),
        stockErrors,
      });
    }

    const bulkOps = normalizedItems.map(item => {
      const product = productMap.get(String(item.product));
      const selectedColor = item.selectedColor || product.color || (Array.isArray(product.colors) && product.colors[0]?.name) || '';
      if (Array.isArray(product.colors) && product.colors.length > 0) {
        const newColors = product.colors.map(color => {
          if (normalizeColorName(color.name) === normalizeColorName(selectedColor)) {
            return { ...color.toObject ? color.toObject() : color, stock: Math.max(0, Number(color.stock || 0) - Number(item.quantity)) };
          }
          return color.toObject ? color.toObject() : color;
        });

        return {
          updateOne: {
            filter: {
              _id: item.product,
              colors: {
                $elemMatch: {
                  name: selectedColor,
                  stock: { $gte: item.quantity }
                }
              },
            },
            update: {
              $set: {
                colors: newColors,
                stock: Math.max(0, (Number(product.stock) || 0) - Number(item.quantity)),
              },
              $inc: { soldCount: item.quantity }
            }
          }
        };
      }

      return {
        updateOne: {
          filter: {
            _id: item.product,
            stock: { $gte: item.quantity },
          },
          update: { $inc: { stock: -item.quantity, soldCount: item.quantity } },
        },
      };
    });

    const stockUpdateResult = await Product.bulkWrite(bulkOps, { session });

    const anyFailed = stockUpdateResult.matchedCount !== bulkOps.length;
    if (anyFailed) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({
        message: AMHARIC_MESSAGES.SIMULTANEOUS,
        conflict: true,
      });
    }

    const computedTotal = normalizedItems.reduce(
      (sum, it) => sum + Number(it.price) * Number(it.quantity),
      0
    );

    const finalShippingAddr =
      shippingAddress ||
      [subcity, streetAddress, houseNumber ? `House #${houseNumber}` : '']
        .filter(Boolean)
        .join(', ');

    const finalTotal = Number(totalAmount) || computedTotal;
    const commissionRate = Number(process.env.PLATFORM_COMMISSION_RATE || 10);
    const commissionAmount = Math.round(finalTotal * (commissionRate / 100) * 100) / 100;
    const sellerPayoutAmount = Math.max(0, finalTotal - commissionAmount);

    const order = new Order({
      user: userId,
      orderNumber: createOrderNumber(),
      customerName: customerName || (req.user ? req.user.fullName : 'Anonymous customer'),
      phone,
      subcity,
      streetAddress,
      houseNumber,
      shippingAddress: finalShippingAddr,
      notes: notes || '',
      items: normalizedItems,
      totalAmount: finalTotal,
      paymentMethod,
      receiptImage: req.body.receiptImage || '',
      paymentStatus: (paymentMethod !== 'cash_on_delivery' && req.body.receiptImage) ? 'receipt_submitted' : 'awaiting_payment',
      orderStatus: 'pending',
      escrowStatus: 'none', // Will be set to 'held' only after payment verification
      payoutStatus: 'pending',
      commissionRate,
      commissionAmount,
      sellerPayoutAmount,
    });

    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    // --- SAFE & NON-BLOCKING TELEGRAM NOTIFICATION ---
    (async () => {
      try {
        const bot = require('../bot'); // Dynamically required to prevent circular initialization errors
        let chatId = null;

        if (userId) {
          const user = await User.findById(userId);
          if (user && user.telegramChatId) {
            chatId = user.telegramChatId;
          }
        }

        // Fallback: search user by phone if telegramChatId was not on req.user
        if (!chatId && phone) {
          const last9Digits = phone.replace(/\D/g, '').slice(-9);
          const userByPhone = await User.findOne({ phone: new RegExp(last9Digits + '$') });
          if (userByPhone && userByPhone.telegramChatId) {
            chatId = userByPhone.telegramChatId;
          }
        }
        // --- SELLER NOTIFICATIONS ---
try {
  const sellerGroups = new Map();
  for (const item of normalizedItems) {
    if (!item.seller) continue;
    const sellerId = String(item.seller);
    if (!sellerGroups.has(sellerId)) sellerGroups.set(sellerId, []);
    sellerGroups.get(sellerId).push(item);
  }

  for (const [sellerId, sellerItems] of sellerGroups) {
    const seller = await User.findById(sellerId).lean();
    if (!seller || !seller.telegramChatId) continue;

    const itemLines = sellerItems
      .map(it => `• ${it.name} x${it.quantity} — ${it.price * it.quantity} ETB`)
      .join('\n');
    const sellerTotal = sellerItems.reduce((sum, it) => sum + it.price * it.quantity, 0);

    const sellerMsg =
      `🛎️ <b>New Order Received!</b>\n\n` +
      `<b>Order Number:</b> <code>${order.orderNumber}</code>\n` +
      `<b>Your items:</b>\n${itemLines}\n\n` +
      `<b>Your total:</b> ${sellerTotal} ETB\n` +
      `<b>Buyer:</b> ${order.customerName}\n` +
      `<b>Delivery to:</b> ${order.shippingAddress}`;

    await bot.telegram.sendMessage(seller.telegramChatId, sellerMsg, {
  parse_mode: 'HTML',
});
  }
} catch (sellerNotifyErr) {
  console.error('Seller notification error:', sellerNotifyErr.message);
}
console.log('=== CHECKOUT TELEGRAM DIAGNOSTIC ===');
console.log('1. User ID from req.user:', req.user?.id || req.user?._id);
console.log('2. Phone from req.body/user:', phone);

if (req.user) {
  const dbUser = await User.findById(req.user.id || req.user._id).lean();
  console.log('3. DB User Found:', dbUser?.fullName);
  console.log('4. telegramChatId on DB User:', dbUser?.telegramChatId);
}
        if (chatId && bot && bot.telegram) {
          const shortId = order._id.toString().slice(-6).toUpperCase();
          const telegramMsg =
            `🎉 <b>Order Placed Successfully!</b>\n\n` +
            `<b>Order Number:</b> <code>${order.orderNumber}</code>\n` +
            `<b>Reference:</b> #${shortId}\n` +
            `<b>Total Amount:</b> ${order.totalAmount} ETB\n` +
            `<b>Status:</b> PENDING\n\n` +
            `Tap the button below anytime to track live updates!`;

          await bot.telegram.sendMessage(chatId, telegramMsg, {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: "🚚 Track Order Status", callback_data: `track_${order._id}` }]
              ]
            }
          });
          console.log(`✅ Telegram checkout push sent successfully to chat ID: ${chatId}`);
        } else {
          console.log(`⚠️ Telegram notification skipped: No linked telegramChatId found for user.`);
        }
      } catch (telegramErr) {
        console.error("Non-fatal Telegram push error:", telegramErr.message);
      }
    })();

    const populated = await Order.findById(order._id).populate('items.product');
    return res.status(201).json({
      message: AMHARIC_MESSAGES.ORDER_CREATED,
      order: populated || order,
    });
  } catch (err) {
    try { if (session?.inTransaction()) await session.abortTransaction(); } catch (_) {}
    try { session?.endSession(); } catch (_) {}
    console.error('Order creation error:', err);

    const isTransactionConflict =
      err?.hasErrorLabel?.('TransientTransactionError') ||
      err?.hasErrorLabel?.('UnknownTransactionCommitResult') ||
      [112, 251].includes(err?.code);

    if (isTransactionConflict) {
      return res.status(409).json({
        message: AMHARIC_MESSAGES.SIMULTANEOUS,
        conflict: true,
      });
    }

    if (err?.name === 'ValidationError' || err?.name === 'CastError') {
      return res.status(400).json({ message: err.message });
    }

    if (err?.code === 11000) {
      return res.status(409).json({ message: 'This order was already submitted. Please check your orders.' });
    }

    return res.status(500).json({
      message: 'ይቅርታ ትእዛዙን በመፍጠር ላይ ስህተት ተከስቷል። እባክዎ እንደገና ይሞክሩ።',
      error: err.message,
    });
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'መግቢያ አስፈላጊ ነው።' });
    }
    const userId = req.user.id || req.user._id;
    const orders = await Order.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate('items.product');

    return res.status(200).json(orders);
  } catch (err) {
    console.error('getMyOrders error:', err);
    return res.status(500).json({ message: err.message });
  }
};

exports.getSellerOrders = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'መግቢያ አስፈላጊ ነው።' });
    }
    const sellerId = req.user.id || req.user._id;
    const orders = await Order.find({ 'items.seller': sellerId })
      .sort({ createdAt: -1 })
      .populate('items.product');

    const filteredOrders = orders.map(order => {
      const plain = order.toObject();
      plain.items = plain.items.filter(it => String(it.seller || '') === String(sellerId));
      return plain;
    }).filter(o => o.items.length > 0);

    return res.status(200).json(filteredOrders);
  } catch (err) {
    console.error('getSellerOrders error:', err);
    return res.status(500).json({ message: err.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.product');
    if (!order) {
      return res.status(404).json({ message: AMHARIC_MESSAGES.NOT_FOUND });
    }

    const currentUserId = req.user ? (req.user.id || req.user._id) : null;
    const canView =
      (currentUserId && String(currentUserId) === String(order.user || '')) ||
      (req.user && (req.user.role === 'admin' || req.user.role === 'seller'));

    if (!canView && !order.phone) {
      return res.status(403).json({ message: AMHARIC_MESSAGES.NOT_AUTHORIZED });
    }

    return res.status(200).json(order);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'መግቢያ አስፈላጊ ነው።' });
    }

    const { status, orderStatus, paymentStatus } = req.body;
    const rawTarget = orderStatus || status;
    const actorId = req.user.id || req.user._id;

    // Normalize status values
    let targetStatus = undefined;
    if (rawTarget !== undefined && rawTarget !== null && String(rawTarget).trim() !== '') {
      const lower = String(rawTarget).trim().toLowerCase();
      if (['canceled', 'cancelled'].includes(lower)) {
        targetStatus = 'cancelled';
      } else if (['delivered'].includes(lower)) {
        targetStatus = 'delivered';
      } else if (['shipping', 'shipped'].includes(lower)) {
        targetStatus = 'shipping';
      } else if (['confirmed', 'accepted'].includes(lower)) {
        targetStatus = 'confirmed';
      } else if (['pending'].includes(lower)) {
        targetStatus = 'pending';
      } else {
        return res.status(400).json({ message: 'ያልተፈቀደ የትእዛዝ ሁኔታ።' });
      }
    }

    // Normalize payment status to new enum values
    let normalizedPayment = undefined;
    if (paymentStatus !== undefined && paymentStatus !== null && String(paymentStatus).trim() !== '') {
      const lowerPay = String(paymentStatus).trim().toLowerCase();
      if (['paid', 'verified'].includes(lowerPay)) {
        normalizedPayment = 'verified';
      } else if (['pending', 'verification pending', 'awaiting_payment', 'unpaid'].includes(lowerPay)) {
        normalizedPayment = 'awaiting_payment';
      } else if (['failed', 'rejected'].includes(lowerPay)) {
        normalizedPayment = 'rejected';
      } else if (['receipt_submitted', 'verification pending'].includes(lowerPay)) {
        normalizedPayment = 'receipt_submitted';
      } else {
        // Pass through unrecognized statuses unchanged
        normalizedPayment = paymentStatus;
      }
    }

    const order = await Order.findById(req.params.id).populate('user');
    if (!order) {
      return res.status(404).json({ message: AMHARIC_MESSAGES.NOT_FOUND });
    }

    const currentUserId = req.user.id || req.user._id;
    const isAdmin = req.user.role === 'admin';
    const isSeller = req.user.role === 'seller';
    const ownSellerItems = isSeller &&
      order.items.some(it => String(it.seller || '') === String(currentUserId));

    const isBuyerOwner = String(order.user?._id || order.user || '') === String(currentUserId) ||
      (order.phone && req.user.phone && String(order.phone).replace(/\D/g, '').slice(-9) === String(req.user.phone).replace(/\D/g, '').slice(-9));

    const buyerAllowedStatuses = ['delivered', 'cancelled'];
    const buyerCanSetThisStatus = isBuyerOwner && (!targetStatus || buyerAllowedStatuses.includes(targetStatus));

    if (!isAdmin && !ownSellerItems && !buyerCanSetThisStatus) {
      return res.status(403).json({ message: AMHARIC_MESSAGES.NOT_AUTHORIZED });
    }

    // Check idempotency - if already in target state, return success
    if (targetStatus && order.orderStatus === targetStatus && !normalizedPayment) {
      return res.status(200).json({
        message: AMHARIC_MESSAGES.STATUS_UPDATED,
        order: await Order.findById(order._id).populate('items.product'),
      });
    }

    // Prepare state transitions
    const transitions = {};
    if (targetStatus) {
      transitions.orderStatus = targetStatus;
    }
    if (normalizedPayment) {
      transitions.paymentStatus = normalizedPayment;
    }

    // Handle special business logic for delivery
    if (targetStatus === 'delivered') {
      // Check if operation can be performed
      const operationCheck = canPerformOperation(order, 'confirm_delivery');
      if (!operationCheck.canProceed) {
        return res.status(400).json({ message: operationCheck.reason });
      }

      // Only release escrow if payment is verified or it's COD
      if (order.paymentStatus === 'verified' || order.paymentMethod === 'cash_on_delivery') {
        transitions.escrowStatus = 'released';
        transitions.payoutStatus = 'ready_for_payout';
        
        // For COD, mark payment as verified when delivered
        if (order.paymentMethod === 'cash_on_delivery' && order.paymentStatus === 'awaiting_payment') {
          transitions.paymentStatus = 'verified';
        }
      } else {
        // Payment not verified - don't release escrow
        transitions.escrowStatus = 'none';
      }
    }

    // Handle cancellation
    if (targetStatus === 'cancelled') {
      const operationCheck = canPerformOperation(order, 'cancel_order');
      if (!operationCheck.canProceed) {
        return res.status(400).json({ message: operationCheck.reason });
      }

      transitions.escrowStatus = 'refunded';
      transitions.payoutStatus = 'cancelled';
    }

    // Use state machine for transition
    const transitionResult = await transitionOrderState(
      order, 
      transitions, 
      actorId, 
      { note: `Order status updated to ${targetStatus || normalizedPayment}` }
    );

    if (!transitionResult.success) {
      return res.status(400).json({ 
        message: 'Failed to update order status', 
        errors: transitionResult.errors 
      });
    }

    // Ensure commission amounts are set
    if (!order.commissionAmount || order.commissionAmount === 0) {
      const rate = order.commissionRate || Number(process.env.PLATFORM_COMMISSION_RATE || 10);
      order.commissionRate = rate;
      order.commissionAmount = Math.round(order.totalAmount * (rate / 100) * 100) / 100;
      order.sellerPayoutAmount = Math.max(0, order.totalAmount - order.commissionAmount);
    }

    await order.save();

    // Handle cancellation side effects
    if (targetStatus === 'cancelled') {
      const bot = require('../bot');
      await restoreOrderStock(order, bot);
      await notifySellersOfCancel(order, bot);
    }

    // Send Seller Delivery & Payout Notification (non-blocking)
    if (targetStatus === 'delivered' && transitions.escrowStatus === 'released') {
      setImmediate(async () => {
        try {
          const bot = require('../bot');
          const sellerIds = [...new Set(order.items.map(it => it.seller || it.product?.seller).filter(Boolean))];
          for (const sId of sellerIds) {
            const seller = await User.findById(sId).lean();
            if (seller && seller.telegramChatId && bot && bot.telegram) {
              const msg =
                `🎉 <b>ORDER DELIVERED — ESCROW RELEASED!</b>\n\n` +
                `<b>Order:</b> <code>${order.orderNumber || order._id}</code>\n` +
                `<b>Gross Total:</b> ${order.totalAmount} ETB\n` +
                `<b>Platform Commission (${order.commissionRate}%):</b> -${order.commissionAmount} ETB\n` +
                `<b>Your Net Payout:</b> <b>${order.sellerPayoutAmount} ETB</b>\n\n` +
                `Status: <b>READY FOR TRANSFER</b> 💸\n` +
                `The platform admin has received the delivery confirmation and will transfer your net earnings to your linked Telebirr/CBE account.`;
              await bot.telegram.sendMessage(seller.telegramChatId, msg, { parse_mode: 'HTML' });
            }
          }
        } catch (err) {
          console.error("Seller delivery notify error:", err.message);
        }
      })();
    }

    // Send Telegram status update push (non-blocking)
    setImmediate(async () => {
      try {
        const bot = require('../bot');
        const customerChatId = order.user?.telegramChatId || order.telegramChatId;
        if (customerChatId && bot && bot.telegram) {
          const statusMessage = 
            `🚚 <b>ORDER UPDATE!</b>\n\n` +
            `Your order <code>${order._id}</code> status has been updated to:\n` +
            `STATUS: <b>${(targetStatus || order.orderStatus).toUpperCase()}</b>`;

          await bot.telegram.sendMessage(customerChatId, statusMessage, { parse_mode: 'HTML' });
        }
      } catch (err) {
        console.error("Telegram status notify error:", err.message);
      }
    });

    const refreshed = await Order.findById(order._id).populate('items.product');

    return res.status(200).json({
      message: AMHARIC_MESSAGES.STATUS_UPDATED,
      order: refreshed,
    });

  } catch (err) {
    console.error('updateOrderStatus error:', err);
    return res.status(500).json({ message: err.message });
  }
};