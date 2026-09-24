// utils/orderCancellation.js
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/user');

// Every spelling of "canceled" that can show up as a status
const CANCELED = ['Canceled', 'Cancelled', 'canceled', 'cancelled'];
const isCanceled = (status) => CANCELED.includes(status);

const normalizeColorName = (value = '') => String(value).trim().toLowerCase();

// Telegram HTML mode breaks on raw < > &
const esc = (v = '') =>
  String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Send a Telegram message without letting a failure (user blocked the bot, etc.) crash the request.
const safeSend = (bot, chatId, text) => {
  if (!bot || !bot.telegram || !chatId) return Promise.resolve(false);
  return bot.telegram
    .sendMessage(chatId, text, { parse_mode: 'HTML' })
    .then(() => true)
    .catch((err) => {
      console.error(`Telegram send failed for ${chatId}:`, err.message);
      return false;
    });
};

/**
 * Notify all waitlisted users when a product gets restocked (> 0 stock).
 */
async function notifyWaitlistedUsers(product, bot) {
  try {
    if (!product || !product.waitlist || product.waitlist.length === 0) return;
    const tgBot = bot || require('../bot');
    if (!tgBot || !tgBot.telegram) return;

    const waitlistEntries = [...product.waitlist];
    if (waitlistEntries.length === 0) return;

    for (const entry of waitlistEntries) {
      let chatId = null;
      if (entry.user) {
        const userDoc = await User.findById(entry.user).lean();
        if (userDoc && userDoc.telegramChatId) {
          chatId = userDoc.telegramChatId;
        }
      }
      if (!chatId && entry.phone) {
        const last9Digits = String(entry.phone).replace(/\D/g, '').slice(-9);
        if (last9Digits) {
          const userByPhone = await User.findOne({ phone: new RegExp(last9Digits + '$') }).lean();
          if (userByPhone && userByPhone.telegramChatId) {
            chatId = userByPhone.telegramChatId;
          }
        }
      }

      if (chatId) {
        const restockMsg =
          `🔔 <b>BACK IN STOCK!</b>\n\n` +
          `Great news! <b>${esc(product.name)}</b> is back in stock (${product.stock} available).\n` +
          `Hurry and place your order before it sells out again!`;

        await safeSend(tgBot, chatId, restockMsg);
      }
    }

    // Clear the waitlist now that they've been notified
    product.waitlist = [];
    await Product.findByIdAndUpdate(product._id, { $set: { waitlist: [] } });
  } catch (err) {
    console.error('[notifyWaitlistedUsers] error:', err.message);
  }
}

/**
 * Restore product stock for a single item (handling color variants & total stock accurately).
 */
async function restoreProductStock(productId, quantity, selectedColor, bot) {
  if (!productId || !quantity) return null;
  const pid = productId._id ? productId._id : productId;
  const qty = Math.max(1, Number(quantity) || 1);

  const product = await Product.findById(pid);
  if (!product) {
    console.warn(`[restock] Product ${pid} not found, skipping restock`);
    return null;
  }

  const prevStock = Number(product.stock) || 0;
  product.soldCount = Math.max(0, (Number(product.soldCount) || 0) - qty);

  if (Array.isArray(product.colors) && product.colors.length > 0) {
    const targetColor = normalizeColorName(selectedColor || product.color || '');
    let matched = false;

    const updatedColors = product.colors.map(color => {
      const colorDoc = color.toObject ? color.toObject() : color;
      const name = String(colorDoc.name || '').trim();
      if (normalizeColorName(name) === targetColor || (!targetColor && product.colors.length === 1)) {
        matched = true;
        return {
          ...colorDoc,
          name,
          stock: Math.max(0, Number(colorDoc.stock || 0) + qty),
        };
      }
      return colorDoc;
    });

    if (!matched && updatedColors.length > 0) {
      const first = updatedColors[0];
      updatedColors[0] = {
        ...first,
        name: String(first.name || 'Default').trim(),
        stock: Math.max(0, Number(first.stock || 0) + qty),
      };
    }

    product.colors = updatedColors;
    product.stock = updatedColors.reduce((sum, c) => sum + Math.max(0, Number(c.stock || 0)), 0);
  } else {
    product.stock = Math.max(0, prevStock + qty);
  }

  await product.save();
  console.log(`[restock] Product "${product.name}" (${product._id}): stock changed from ${prevStock} -> ${product.stock}`);

  if (prevStock === 0 && product.stock > 0) {
    await notifyWaitlistedUsers(product, bot);
  }

  return product;
}

/**
 * Restores stock for all items in an order.
 */
async function restoreOrderStock(order, bot) {
  if (!order || !Array.isArray(order.items)) return;
  for (const item of order.items) {
    const productId = item.product?._id || item.product;
    if (productId) {
      try {
        await restoreProductStock(productId, item.quantity, item.selectedColor, bot);
      } catch (err) {
        console.error(`[restock] Failed to restore stock for item ${item.name}:`, err.message);
      }
    }
  }
}

/**
 * Cancel an order ONE time and put its items back in stock.
 */
async function cancelOrder(orderId, { status = 'cancelled', extra = {}, bot } = {}) {
  const normalizedStatus = status.toLowerCase() === 'canceled' ? 'cancelled' : status;

  // Atomically find non-canceled order and update status
  const order = await Order.findOneAndUpdate(
    { _id: orderId, orderStatus: { $nin: CANCELED } },
    { ...extra, orderStatus: normalizedStatus },
    { new: true }
  )
    .populate('user')
    .populate('items.product');

  if (!order) {
    console.log(`[cancel] order ${orderId}: not found or already canceled, nothing restocked`);
    return null;
  }

  console.log(`[cancel] order ${order._id} saved as "${normalizedStatus}" with ${order.items.length} item(s)`);

  const tgBot = bot || require('../bot');
  await restoreOrderStock(order, tgBot);

  return order;
}

/**
 * Tell each seller in the order that it was canceled.
 */
async function notifySellersOfCancel(order, bot) {
  try {
    const tgBot = bot || require('../bot');
    const bySeller = new Map();
    for (const item of order.items) {
      const sellerId = String(item.seller || item.product?.seller || item.product?.sellerId || '');
      if (!sellerId) continue;
      if (!bySeller.has(sellerId)) bySeller.set(sellerId, []);
      bySeller.get(sellerId).push(item);
    }
    if (bySeller.size === 0) {
      return;
    }

    const sellers = await User.find({ _id: { $in: [...bySeller.keys()] } });

    for (const seller of sellers) {
      if (!seller.telegramChatId) continue;

      const lines = bySeller
        .get(String(seller._id))
        .map(
          (i) =>
            `• ${esc(i.name || i.product?.title || i.product?.name || 'Item')} × ${i.quantity}`
        )
        .join('\n');

      const msg =
        `❌ <b>ORDER CANCELED</b>\n\n` +
        `<b>Order ID:</b> <code>#${order._id}</code>\n` +
        `<b>Customer Phone:</b> ${esc(order.phone)}\n\n` +
        `<b>Back in stock:</b>\n${lines}`;

      await safeSend(tgBot, seller.telegramChatId, msg);
    }
  } catch (err) {
    console.error('Seller cancel notification failed:', err.message);
  }
}

module.exports = {
  CANCELED,
  isCanceled,
  normalizeColorName,
  cancelOrder,
  restoreProductStock,
  restoreOrderStock,
  notifySellersOfCancel,
  notifyWaitlistedUsers,
  safeSend
};