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
  telegramHandle: { type: String, default: '' },

}, { timestamps: true });

userSchema.index({ role: 1 });
userSchema.index({ banned: 1 });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
