const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, required: true, unique: true, trim: true, maxlength: 20 },
  email: { type: String, lowercase: true, trim: true, maxlength: 120, default: '' },
  password: { type: String, required: true },
  role: { type: String, enum: ['buyer', 'seller', 'admin'], default: 'buyer' },
  telegramHandle: { type: String, default: '', trim: true },
  shopName: { type: String, default: '', trim: true },
  banned: { type: Boolean, default: false },
  telegramChatId: { type: String, default: '' },
  sellerTelebirr: { type: String, default: '', trim: true },
  sellerCbeAccount: { type: String, default: '', trim: true },
  sellerBankName: { type: String, default: 'Commercial Bank of Ethiopia', trim: true },
}, { 
  timestamps: true,
  // Handle duplicate key errors gracefully
  autoIndex: false 
});

// Existing indexes
userSchema.index({ role: 1 });
userSchema.index({ banned: 1 });

// NEW OPTIMIZATION: Add indexes for frequently queried fields
userSchema.index({ telegramChatId: 1 }); // Fast lookup for Telegram notifications
userSchema.index({ telegramHandle: 1 }); // Fast lookup for seller profiles
userSchema.index({ sellerTelebirr: 1 }); // Fast lookup for seller payment info
userSchema.index({ createdAt: -1 }); // For sorting users by signup date

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
