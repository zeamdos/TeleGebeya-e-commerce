const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['buyer', 'seller', 'admin'], default: 'buyer' },
  telegramHandle: { type: String, default: '' }
},
 { timestamps: true });

module.exports = mongoose.model('User', userSchema);