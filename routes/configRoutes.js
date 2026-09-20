const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'TeleGebeya_Shop_bot';
  res.json({
    telegramBotUsername: botUsername,
    botDeepLinkBase: `https://t.me/${botUsername}`,
    freeDeliveryThreshold: 1000,
    defaultDeliveryFee: 150,
    paymentMethods: ['telebirr', 'cash_on_delivery', 'cbe_birr'],
    marketplaceName: 'TeleGebeya'
  });
});

module.exports = router;
