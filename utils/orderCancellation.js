// utils/orderCancellation.js
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

// The field in your Product model that holds the stock number.
// If restocking does nothing, this name is the first thing to check.
const STOCK_FIELD = 'stock';

// Every spelling of "canceled" that can show up as a status
const CANCELED = ['Canceled', 'Cancelled', 'canceled', 'cancelled'];
const isCanceled = (status) => CANCELED.includes(status);

// Telegram HTML mode breaks on raw < > &
const esc = (v = '') =>
  String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Send a Telegram message without letting a failure (user blocked the bot, etc.) crash the request.
// Returns true if it was sent, false if it failed.
const safeSend = (bot, chatId, text) =>
  bot.telegram
    .sendMessage(chatId, text, { parse_mode: 'HTML' })
    .then(() => true)
    .catch((err) => {
      console.error(`Telegram send failed for ${chatId}:`, err.message);
      return false;
    });

/**
 * Cancel an order ONE time and put its items back in stock.
 *
 * Returns the updated order, or null if the order doesn't exist or was already canceled.
 * The "not already canceled" check is inside the update itself, so double-tapping
 * Cancel (two requests at once) can never restock twice.
 *
 * status: which spelling to save ('Canceled' or 'cancelled')
 * extra:  any other fields to set at the same time, e.g. { paymentStatus: 'Rejected' }
 */
async function cancelOrder(orderId, { status = 'Canceled', extra = {} } = {}) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, orderStatus: { $nin: CANCELED } },
    { ...extra, orderStatus: status },
    { new: true }
  )
    .populate('user')
    .populate('items.product');

  if (!order) {
    console.log(`[cancel] order ${orderId}: not found or already canceled, nothing restocked`);
    return null;
  }

  console.log(`[cancel] order ${order._id} saved as "${status}" with ${order.items.length} item(s)`);

  // If the stock field isn't in the Product schema, Mongoose silently ignores the update.
  // Print the real field names so it's obvious which one to use.
  if (!Product.schema.path(STOCK_FIELD)) {
    console.warn(
      `[cancel] your Product schema has no "${STOCK_FIELD}" field, so restocking will be ignored. ` +
        `Fields in the schema: ${Object.keys(Product.schema.paths).join(', ')}. ` +
        `Set STOCK_FIELD at the top of utils/orderCancellation.js to the right one.`
    );
  }

  // Put the stock back ($inc is atomic, so it's safe if other orders are changing stock too)
  for (const item of order.items) {
    if (!item.product) {
      console.warn(`[cancel] "${item.name}" has no linked product, so it can't be restocked`);
      continue;
    }
    try {
      const result = await Product.updateOne(
        { _id: item.product._id },
        { $inc: { [STOCK_FIELD]: item.quantity } }
      );
      console.log(
        `[cancel] product ${item.product._id}: +${item.quantity} to "${STOCK_FIELD}" ->`,
        JSON.stringify(result)
      );
      if (!(result.modifiedCount ?? result.nModified)) {
        console.warn(
          `[cancel] nothing changed for product ${item.product._id}. ` +
            `Most likely "${STOCK_FIELD}" isn't the real stock field name in your Product schema.`
        );
      }
    } catch (err) {
      // The order is already canceled at this point, so log loudly instead of failing the request
      console.error(`[cancel] RESTOCK FAILED for product ${item.product._id}:`, err.message);
    }
  }

  return order;
}

/**
 * Tell each seller in the order that it was canceled.
 * If an order has items from several sellers, each seller only sees their own items.
 */
async function notifySellersOfCancel(order, bot) {
  try {
    // Group items by seller: item.seller if saved on the order, else the product's seller
    const bySeller = new Map();
    for (const item of order.items) {
      const sellerId = String(item.seller || item.product?.seller || item.product?.sellerId || '');
      if (!sellerId) continue;
      if (!bySeller.has(sellerId)) bySeller.set(sellerId, []);
      bySeller.get(sellerId).push(item);
    }
    if (bySeller.size === 0) {
      console.warn(`[cancel] order ${order._id}: no seller found on its items, so nobody was notified`);
      return;
    }

    const sellers = await User.find({ _id: { $in: [...bySeller.keys()] } });

    for (const seller of sellers) {
      if (!seller.telegramChatId) {
        console.warn(
          `[cancel] seller ${seller._id} has no telegramChatId, skipped. ` +
            `They need to link their Telegram in the bot first.`
        );
        continue;
      }

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

      const sent = await safeSend(bot, seller.telegramChatId, msg);
      console.log(`[cancel] seller ${seller._id}: ${sent ? 'notified' : 'Telegram send failed'}`);
    }
  } catch (err) {
    console.error('Seller cancel notification failed:', err.message);
  }
}

module.exports = { CANCELED, isCanceled, cancelOrder, notifySellersOfCancel, safeSend };