const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// 1. /start Command — User links their phone number
bot.start((ctx) => {
  ctx.reply(
    "Welcome to TeleGebeya! \n\nPlease share your phone number to link your account for real-time order & delivery updates.",
    Markup.keyboard([
      [Markup.button.contactRequest("📱 Link TeleGebeya Account")]
    ]).oneTime().resize()
  );
});

// 2. Handle phone number sharing
bot.on('contact', async (ctx) => {
  try {
    const rawPhone = ctx.message.contact.phone_number;
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const last9Digits = cleanPhone.slice(-9);
    const chatId = ctx.chat.id;

    console.log('====================================');
    console.log('👉 YOUR TELEGRAM CHAT ID IS:', chatId);
    console.log('====================================');

    const User = require('./models/User');
    
    // Find user by phone (matching digits) and update their telegramChatId
    const user = await User.findOneAndUpdate(
      { phone: new RegExp(last9Digits + '$') }, 
      { telegramChatId: chatId },
      { returnDocument: 'after' }
    );

    if (user) {
      ctx.reply(
        `✅ Connected! Your Telegram is linked to ${user.fullName || 'your account'}.\nYou will receive instant notifications here!`, 
        Markup.removeKeyboard()
      );
    } else {
      ctx.reply(
        `⚠️ Couldn't find a TeleGebeya account with phone ending in ...${last9Digits}.\n` +
        `Please make sure you register on the web app using this phone number first, then try again.`, 
        Markup.removeKeyboard()
      );
    }
  } catch (err) {
    console.error("Bot Contact Linking Error:", err);
    ctx.reply(`⚠️ Connection error occurred. Try again later.`, Markup.removeKeyboard());
  }
});

// 3. Track Command
bot.command('track', async (ctx) => {
  const args = ctx.message.text.split(' ');
  const orderId = args[1];

  if (!orderId) {
    return ctx.reply('⚠️ Please provide an Order ID.\nUsage: /track <YOUR_ORDER_ID>');
  }

  try {
    const Order = require('./models/Order');
    const order = await Order.findById(orderId).populate('items.product');

    if (!order) {
      return ctx.reply('❌ Order not found. Please double-check your Order ID.');
    }

    const message = 
      `<b>Order Status: ${order.orderStatus ? order.orderStatus.toUpperCase() : 'PENDING'}</b>\n\n` +
      `<b>Order Number:</b> <code>${order.orderNumber || order._id}</code>\n` +
      `<b>Total Amount:</b> ${order.totalAmount} ETB\n` +
      `<b>Delivery Address:</b> ${order.shippingAddress || 'N/A'}\n` +
      `<b>Date:</b> ${new Date(order.createdAt).toLocaleDateString()}`;

    ctx.replyWithHTML(message);
  } catch (err) {
    ctx.reply('Invalid Order ID format.');
  }
});

// 4. Handle "Track Order Status" inline button (from checkout notification)
bot.action(/^track_(.+)$/, async (ctx) => {
  try {
    const Order = require('./models/Order');
    const orderId = ctx.match[1];
    const order = await Order.findById(orderId);

    await ctx.answerCbQuery(); // stop the button's loading spinner either way

    if (!order) {
      return ctx.reply('❌ Order not found.');
    }

    const message =
      `<b>Order Status: ${(order.orderStatus || 'pending').toUpperCase()}</b>\n\n` +
      `<b>Order Number:</b> <code>${order.orderNumber || order._id}</code>\n` +
      `<b>Total Amount:</b> ${order.totalAmount} ETB\n` +
      `<b>Delivery Address:</b> ${order.shippingAddress || 'N/A'}\n` +
      `<b>Date:</b> ${new Date(order.createdAt).toLocaleDateString()}`;

    ctx.replyWithHTML(message);
  } catch (err) {
    console.error('track_ action error:', err.message);
    try { await ctx.answerCbQuery('Something went wrong.'); } catch (_) {}
  }
});

// Graceful stop handling for Node processes
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

bot.launch().then(() => console.log('TeleGebeya Bot active!'));

module.exports = bot;