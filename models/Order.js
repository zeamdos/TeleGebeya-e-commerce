const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, default: () => 'TG-' + Math.floor(100000 + Math.random() * 900000) },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  customerName: { type: String, default: 'Valued Customer' },
  phone: { type: String, required: true },
  subcity: { type: String, default: 'Bole' },
  streetAddress: { type: String, default: '' },
  houseNumber: { type: String, default: '' },
  shippingAddress: { type: String },
  notes: { type: String, default: '' },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String },
    imageUrl: { type: String },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }
  }],
  totalAmount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['telebirr', 'cash_on_delivery', 'cbe_birr'], default: 'telebirr' },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  orderStatus: { type: String, enum: ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'], default: 'pending' },
  telebirrTransactionId: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
