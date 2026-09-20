const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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
    price: { type: Number, required: true },
    selectedColor: { type: String, default: '' },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  totalAmount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['telebirr', 'cash_on_delivery', 'cbe_birr'], default: 'telebirr' },
  receiptImage: { type: String, default: '' },
  // REPLACE paymentStatus and orderStatus lines with:
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'Verification Pending', 'Paid', 'Rejected', 'paid', 'failed'], 
    default: 'pending' 
  },
  orderStatus: { 
    type: String, 
    enum: ['pending', 'Accepted', 'confirmed', 'shipping', 'Delivered', 'delivered', 'Canceled', 'cancelled'], 
    default: 'pending' 
  },
  telebirrTransactionId: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
