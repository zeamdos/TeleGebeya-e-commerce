const mongoose = require('mongoose');

// Status history entry schema
const statusHistorySchema = new mongoose.Schema({
  stateType: { type: String, required: true }, // paymentStatus, escrowStatus, payoutStatus, orderStatus
  oldState: { type: String, required: true },
  newState: { type: String, required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // User who made the change
  actorRole: { type: String }, // Role at time of change (for audit if role changes)
  note: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

// Per-item payout tracking schema
const itemPayoutSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subtotal: { type: Number, required: true }, // Item total before commission
  commissionAmount: { type: Number, default: 0 },
  netPayoutAmount: { type: Number, required: true },
  payoutAccount: {
    type: String,
    default: '' // Snapshot of seller's payout account at time of calculation
  },
  payoutAccountType: { type: String, enum: ['telebirr', 'cbe_birr'], default: 'telebirr' }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  orderNumber: { type: String, default: () => 'TG-' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1000).toString().padStart(3, '0') },
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
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Per-item payout tracking
    payout: { type: itemPayoutSchema, default: null }
  }],
  totalAmount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['telebirr', 'cash_on_delivery', 'cbe_birr'], default: 'telebirr' },
  
  // Receipt information
  receiptImage: { type: String, default: '' },
  receiptFilename: { type: String, default: '' },
  receiptMimeType: { type: String, default: '' },
  receiptSize: { type: Number, default: 0 },
  transactionId: { type: String, sparse: true }, // Unique transaction ID for duplicate prevention
  
  // Payment status - cleaned up enum
  paymentStatus: { 
    type: String, 
    enum: ['awaiting_payment', 'receipt_submitted', 'verified', 'rejected'], 
    default: 'awaiting_payment' 
  },
  
  // Order status - cleaned up enum
  orderStatus: { 
    type: String, 
    enum: ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'], 
    default: 'pending' 
  },
  
  // Escrow status
  escrowStatus: {
    type: String,
    enum: ['none', 'held', 'released', 'refunded'],
    default: 'none'
  },
  
  // Payout status
  payoutStatus: {
    type: String,
    enum: ['pending', 'ready_for_payout', 'paid_to_seller', 'cancelled'],
    default: 'pending'
  },
  
  // Dispute handling
  disputeStatus: {
    type: String,
    enum: ['none', 'open', 'investigating', 'resolved', 'closed'],
    default: 'none'
  },
  disputeReason: { type: String, default: '' },
  disputeResolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  disputeResolvedAt: { type: Date },
  
  // Commission and payout tracking
  commissionRate: { type: Number, default: 10 },
  commissionAmount: { type: Number, default: 0 },
  sellerPayoutAmount: { type: Number, default: 0 },
  
  // Audit trail fields
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: { type: Date },
  rejectionReason: { type: String, default: '' },
  releasedAt: { type: Date },
  payoutPaidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  payoutPaidAt: { type: Date },
  payoutReference: { type: String, default: '' },
  
  // Complete status history
  statusHistory: [statusHistorySchema],
  
  // Auto-release timer (calculated on demand)
  autoReleaseEligibleAt: { type: Date },
  
  // Metadata
  metadata: {
    type: Map,
    of: String,
    default: new Map()
  }
}, { 
  timestamps: true,
  // Add optimistic concurrency support
  optimisticConcurrency: true
});

// Indexes for performance and data integrity
orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ 'items.seller': 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1, createdAt: -1 });
orderSchema.index({ escrowStatus: 1, createdAt: -1 });
orderSchema.index({ payoutStatus: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });
orderSchema.index({ phone: 1 }); // For guest order lookup
orderSchema.index({ createdAt: -1 }); // For general sorting
// Note: transactionId uniqueness is enforced in application logic to avoid schema conflicts

// Virtual for formatted order number
orderSchema.virtual('formattedOrderNumber').get(function() {
  return this.orderNumber || `ORD-${this._id.toString().slice(-8).toUpperCase()}`;
});

// Virtual for commission percentage display
orderSchema.virtual('commissionPercentage').get(function() {
  return this.commissionRate ? `${this.commissionRate}%` : '10%';
});

// Method to check if order is in a terminal state
orderSchema.methods.isTerminal = function() {
  const terminalStates = ['delivered', 'cancelled'];
  return terminalStates.includes(this.orderStatus);
};

// Method to check if order can be cancelled
orderSchema.methods.canBeCancelled = function() {
  return !this.isTerminal() && this.payoutStatus !== 'paid_to_seller';
};

// Method to check if order is ready for payout
orderSchema.methods.isReadyForPayout = function() {
  return this.orderStatus === 'delivered' && 
         this.escrowStatus === 'released' && 
         this.payoutStatus === 'ready_for_payout';
};

// Method to get seller-specific payout info
orderSchema.methods.getSellerPayoutInfo = function(sellerId) {
  const sellerItems = this.items.filter(item => 
    String(item.seller) === String(sellerId)
  );
  
  if (sellerItems.length === 0) return null;
  
  const subtotal = sellerItems.reduce((sum, item) => 
    sum + (item.price * item.quantity), 0
  );
  
  const itemPayouts = sellerItems
    .filter(item => item.payout)
    .map(item => item.payout);
  
  const totalCommission = itemPayouts.reduce((sum, payout) => 
    sum + (payout.commissionAmount || 0), 0
  );
  
  const totalNetPayout = itemPayouts.reduce((sum, payout) => 
    sum + (payout.netPayoutAmount || 0), 0
  );
  
  return {
    sellerId,
    itemCount: sellerItems.length,
    subtotal,
    totalCommission,
    totalNetPayout,
    payoutDetails: itemPayouts
  };
};

// Pre-save middleware to normalize status values (for migration compatibility)
orderSchema.pre('save', function() {
  // Normalize legacy payment status values
  const paymentStatusMap = {
    'pending': 'awaiting_payment',
    'Verification Pending': 'receipt_submitted',
    'Paid': 'verified',
    'paid': 'verified',
    'Rejected': 'rejected',
    'rejected': 'rejected',
    'failed': 'rejected',
    'Unpaid': 'awaiting_payment',
    'unpaid': 'awaiting_payment'
  };

  if (paymentStatusMap[this.paymentStatus]) {
    this.paymentStatus = paymentStatusMap[this.paymentStatus];
  }

  const orderStatusMap = {
    'Accepted': 'confirmed',
    'accepted': 'confirmed',
    'Shipped': 'shipping',
    'shipped': 'shipping',
    'Delivered': 'delivered',
    'delivered': 'delivered',
    'Canceled': 'cancelled',
    'canceled': 'cancelled',
    'Cancelled': 'cancelled'
  };

  if (orderStatusMap[this.orderStatus]) {
    this.orderStatus = orderStatusMap[this.orderStatus];
  }
});

module.exports = mongoose.model('Order', orderSchema);