const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['buyer', 'seller', 'admin'], default: 'buyer' },
  telegramHandle: { type: String, default: '' },
  shopName: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);