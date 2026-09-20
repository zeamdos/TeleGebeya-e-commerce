const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

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

const restoreProductStock = async (productId, quantity, selectedColor, session) => {
  if (!productId || !quantity) return;

  const product = await Product.findById(productId).session(session);
  if (!product) return;

  const qty = Math.max(0, Number(quantity) || 0);
  if (qty <= 0) return;

  if (Array.isArray(product.colors) && product.colors.length > 0) {
    const targetColor = normalizeColorName(selectedColor || product.color || '');
    const updatedColors = product.colors.map(color => {
      const colorDoc = color.toObject ? color.toObject() : color;
      const name = String(colorDoc.name || '').trim();
      if (normalizeColorName(name) !== targetColor) {
        return colorDoc;
      }
      return {
        ...colorDoc,
        stock: Math.max(0, Number(colorDoc.stock || 0) + qty),
      };
    });

    const totalStock = updatedColors.reduce((sum, color) => sum + Math.max(0, Number(color.stock || 0)), 0);
    await Product.findByIdAndUpdate(
      productId,
      { $set: { colors: updatedColors, stock: totalStock } },
      { session }
    );
    return;
  }

  await Product.findByIdAndUpdate(productId, { $inc: { stock: qty } }, { session });
};

exports.createOrder = async (req, res) => {
  const session = await Order.startSession();
  session.startTransaction();

  try {
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
      return {
        product: pid,
        name: item.name || product.name,
        imageUrl: item.imageUrl || product.imageUrl,
        quantity: qty,
        price: Number(item.price ?? product.price ?? 0),
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
              colors: { $elemMatch: { name: { $exists: true }, stock: { $gte: item.quantity } } },
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

    const userId = req.user ? (req.user.id || req.user._id) : undefined;

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
      totalAmount: Number(totalAmount) || computedTotal,
      paymentMethod,
      paymentStatus: 'pending',
      orderStatus: 'pending',
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
    try { await session.abortTransaction(); } catch (_) {}
    try { session.endSession(); } catch (_) {}
    console.error('Order creation error:', err);
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
    const targetStatus = orderStatus || status;
    
    const allowedStatuses = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'];
    const allowedPay = ['pending', 'paid', 'failed'];

    if (targetStatus && !allowedStatuses.includes(targetStatus)) {
      return res.status(400).json({ message: 'ያልተፈቀደ የትእዛዝ ሁኔታ።' });
    }
    if (paymentStatus !== undefined && !allowedPay.includes(paymentStatus)) {
      return res.status(400).json({ message: 'ያልተፈቀደ የክፍያ ሁኔታ።' });
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

     const isBuyerOwner = String(order.user?._id || order.user || '') === String(currentUserId);

      const buyerAllowedStatuses = ['delivered', 'cancelled'];
    const buyerCanSetThisStatus = isBuyerOwner && (!targetStatus || buyerAllowedStatuses.includes(targetStatus));

    if (!isAdmin && !ownSellerItems && !buyerCanSetThisStatus) {
      return res.status(403).json({ message: AMHARIC_MESSAGES.NOT_AUTHORIZED });
    }
    const wasAlreadyCancelled = order.orderStatus === 'cancelled';
    const isNewlyCancelled = targetStatus === 'cancelled' && !wasAlreadyCancelled;

    
    if (targetStatus) order.orderStatus = targetStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;

    if (targetStatus === 'cancelled') {
      const session = await Order.startSession();
      session.startTransaction();
      try {
        for (const item of order.items) {
          await restoreProductStock(item.product, item.quantity, item.selectedColor, session);
        }
        await order.save({ session });
        await session.commitTransaction();
        session.endSession();
      } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
      }
    } else {
      await order.save();
    }

    // Send Telegram status update push
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