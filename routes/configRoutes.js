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
    marketplaceName: 'TeleGebeya',
    adminTelebirrNumber: process.env.ADMIN_TELEBIRR_NUMBER || '0911000000',
    adminCbeAccount: process.env.ADMIN_CBE_ACCOUNT || '1000123456789',
    adminAccountName: process.env.ADMIN_ACCOUNT_NAME || 'TeleGebeya Platform Escrow',
    platformCommissionRate: Number(process.env.PLATFORM_COMMISSION_RATE || 10)
  });
});

module.exports = router;
