const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 240 },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, default: 25, min: 0 },
  soldCount: { type: Number, default: 0, min: 0 },
  category: { type: String, default: 'Other' },
  imageUrl: { type: String, default: '' },
  thumbnailUrl: { type: String, default: '' },
  images: [{ type: String }],
  color: { type: String, default: '' },
  colors: [{
    name: { type: String, trim: true },
    stock: { type: Number, default: 0, min: 0 }
  }],

  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sellerName: { type: String, default: 'TeleGebeya Verified Seller' },
  sellerPhone: { type: String, default: '0911223344' },
sellerTelebirr: { type: String, default: '' },      
  sellerCbeAccount: { type: String, default: '' },

  telegramHandle: { type: String, default: '@TeleGebeya_Shop_bot' },
  telegramPostUrl: { type: String, default: '' },
  rating: { type: Number, default: 4.8 },
  reviewsCount: { type: Number, default: 0 },
  reviews: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, default: 'Customer' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
  }],
  featured: { type: Boolean, default: false },
  tags: [{ type: String }],
  waitlist: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    phone: { type: String, default: '' },
    name: { type: String, default: '' },
    selectedColor: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
  }],
}, { timestamps: true });

productSchema.index({ category: 1, price: 1 });
productSchema.index({ seller: 1 });
productSchema.index({ featured: 1 });
productSchema.index({ name: 'text', description: 'text', category: 'text' });

module.exports = mongoose.model('Product', productSchema);
