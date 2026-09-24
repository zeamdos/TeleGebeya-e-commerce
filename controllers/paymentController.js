const Order = require('../models/Order');
const User = require('../models/user');
const { transitionOrderState, canPerformOperation } = require('../utils/orderStateMachine');
const { validateReceiptSubmission } = require('../utils/receiptValidator');

/**
 * Production-grade Payment Controller
 * 
 * Design Principles:
 * - State machine for all transitions
 * - Idempotent operations
 * - Comprehensive validation
 * - Audit trail
 * - Error handling
 * - Scalability
 */

/**
 * Calculate commission using integer math to avoid floating point errors
 * @param {number} amount - Amount to calculate commission on
 * @param {number} rate - Commission rate percentage
 * @returns {Object} - { commissionAmount, netAmount }
 */
function calculateCommission(amount, rate) {
  // Convert to cents/santim for integer math
  const amountInCents = Math.round(amount * 100);
  const commissionInCents = Math.round((amountInCents * rate) / 100);
  const netInCents = amountInCents - commissionInCents;
  
  return {
    commissionAmount: commissionInCents / 100,
    netAmount: netInCents / 100
  };
}

/**
 * Calculate per-seller commission and payout amounts
 * @param {Array} items - Order items
 * @param {number} commissionRate - Commission rate percentage
 * @returns {Array} - Array of payout objects per seller
 */
function calculateSellerPayouts(items, commissionRate) {
  const sellerGroups = new Map();
  
  // Group items by seller
  items.forEach(item => {
    if (!item.seller) return;
    
    const sellerId = String(item.seller);
    if (!sellerGroups.has(sellerId)) {
      sellerGroups.set(sellerId, []);
    }
    sellerGroups.get(sellerId).push(item);
  });
  
  // Calculate payouts per seller
  const payouts = [];
  for (const [sellerId, sellerItems] of sellerGroups) {
    const subtotal = sellerItems.reduce((sum, item) => 
      sum + (item.price * item.quantity), 0
    );
    
    const { commissionAmount, netAmount } = calculateCommission(subtotal, commissionRate);
    
    payouts.push({
      seller: sellerId,
      subtotal,
      commissionAmount,
      netPayoutAmount: netAmount
    });
  }
  
  return payouts;
}

/**
 * Generate payment instructions for a given payment method
 * @param {Object} order - Order document
 * @returns {Object} - { instructions, paymentDetails }
 */
function generatePaymentInstructions(order) {
  const paymentMethod = order.paymentMethod;
  const amount = order.totalAmount;
  const orderNumber = order.orderNumber;
  
  let instructions = '';
  let paymentDetails = {};
  
  switch (paymentMethod) {
    case 'telebirr':
      instructions = `
📱 <b>TELEBIRR PAYMENT INSTRUCTIONS</b>

1. Open your Telebirr app
2. Select "Send Money"
3. Enter Admin Telebirr Number: ${process.env.ADMIN_TELEBIRR_NUMBER || '0911000000'}
4. Enter Amount: ${amount} ETB
5. Enter Reference: ${orderNumber}
6. Complete the payment
7. Upload the payment receipt screenshot

⚠️ <b>IMPORTANT:</b> Use the exact order number (${orderNumber}) as reference to ensure proper verification.
`;
      paymentDetails = {
        paymentMethod: 'telebirr',
        accountNumber: process.env.ADMIN_TELEBIRR_NUMBER || '0911000000',
        accountName: 'TeleGebeya Platform Escrow',
        reference: orderNumber,
        amount
      };
      break;
      
    case 'cbe_birr':
      instructions = `
🏦 <b>CBE BIRR PAYMENT INSTRUCTIONS</b>

1. Open your CBE Birr app
2. Select "Transfer" or "Send Money"
3. Enter Admin CBE Account: ${process.env.ADMIN_CBE_ACCOUNT || '1000123456789'}
4. Enter Amount: ${amount} ETB
5. Enter Reference: ${orderNumber}
6. Complete the payment
7. Upload the payment receipt screenshot

⚠️ <b>IMPORTANT:</b> Use the exact order number (${orderNumber}) as reference to ensure proper verification.
`;
      paymentDetails = {
        paymentMethod: 'cbe_birr',
        accountNumber: process.env.ADMIN_CBE_ACCOUNT || '1000123456789',
        accountName: 'TeleGebeya Platform Escrow',
        bankName: 'Commercial Bank of Ethiopia',
        reference: orderNumber,
        amount
      };
      break;
      
    case 'cash_on_delivery':
      instructions = `
💵 <b>CASH ON DELIVERY</b>

No advance payment required. Pay cash upon delivery.
Amount: ${amount} ETB

Payment will be collected when your order is delivered.
`;
      paymentDetails = {
        paymentMethod: 'cash_on_delivery',
        amount,
        note: 'Pay upon delivery'
      };
      break;
      
    default:
      throw new Error(`Unsupported payment method: ${paymentMethod}`);
  }
  
  return { instructions, paymentDetails };
}

/**
 * Initiate payment - generate payment instructions
 */
exports.initiatePayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.user.id || req.user._id;
    
    // Find order and verify ownership
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Verify user owns this order
    if (String(order.user) !== String(userId)) {
      return res.status(403).json({ message: 'Not authorized to access this order' });
    }
    
    // Check if payment can be initiated
    if (order.paymentStatus !== 'awaiting_payment' && order.paymentStatus !== 'rejected') {
      return res.status(400).json({ 
        message: `Payment cannot be initiated. Current status: ${order.paymentStatus}` 
      });
    }
    
    // Generate payment instructions
    const { instructions, paymentDetails } = generatePaymentInstructions(order);
    
    res.json({
      message: 'Payment instructions generated successfully',
      order: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus
      },
      paymentInstructions: instructions,
      paymentDetails
    });
    
  } catch (error) {
    console.error('Payment initiation error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Upload payment receipt - idempotent with validation
 */
exports.uploadPaymentReceipt = async (req, res) => {
  try {
    const { orderId, receiptImage, transactionId, filename } = req.body;
    const userId = req.user.id || req.user._id;
    
    // Validate receipt data
    const validation = validateReceiptSubmission({ receiptImage, transactionId, filename });
    if (!validation.valid) {
      return res.status(400).json({ 
        message: 'Invalid receipt data', 
        errors: validation.errors 
      });
    }
    
    // Find order and verify ownership
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Verify user owns this order
    if (String(order.user) !== String(userId)) {
      return res.status(403).json({ message: 'Not authorized to upload receipt for this order' });
    }
    
    // Check if operation can be performed (idempotency)
    const operationCheck = canPerformOperation(order, 'upload_receipt');
    if (!operationCheck.canProceed && order.paymentStatus === 'receipt_submitted') {
      // Already submitted - return success for idempotency
      return res.json({
        message: 'Receipt already submitted',
        order: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          paymentStatus: order.paymentStatus
        }
      });
    }
    
    // Check for duplicate transaction ID
    if (validation.sanitized.transactionId) {
      const existingOrder = await Order.findOne({ 
        transactionId: validation.sanitized.transactionId,
        _id: { $ne: orderId }
      });
      
      if (existingOrder) {
        return res.status(400).json({ 
          message: 'This transaction ID has already been used for another order',
          existingOrderNumber: existingOrder.orderNumber
        });
      }
    }
    
    // Use state machine for transition
    const actorId = userId;
    const transitions = {
      paymentStatus: 'receipt_submitted'
    };
    
    const transitionResult = await transitionOrderState(
      order, 
      transitions, 
      actorId, 
      { note: 'Receipt uploaded by buyer' }
    );
    
    if (!transitionResult.success) {
      return res.status(400).json({ 
        message: 'Failed to update payment status', 
        errors: transitionResult.errors 
      });
    }
    
    // Update order with receipt data
    order.receiptImage = validation.sanitized.receiptImage;
    order.receiptFilename = validation.sanitized.receiptFilename;
    order.receiptMimeType = validation.sanitized.receiptMimeType;
    order.receiptSize = validation.sanitized.receiptSize;
    order.transactionId = validation.sanitized.transactionId;
    
    await order.save();
    
    // Notify admin via Telegram (non-blocking)
    setImmediate(async () => {
      try {
        const bot = require('../bot');
        const adminUsers = await User.find({ role: 'admin' });
        
        for (const admin of adminUsers) {
          if (admin.telegramChatId && bot && bot.telegram) {
            const adminMsg = `
💰 <b>NEW PAYMENT RECEIPT UPLOADED</b>

<b>Order:</b> ${order.orderNumber}
<b>Buyer:</b> ${order.customerName}
<b>Amount:</b> ${order.totalAmount} ETB
<b>Payment Method:</b> ${order.paymentMethod}
<b>Transaction ID:</b> ${order.transactionId || 'N/A'}
<b>Status:</b> AWAITING VERIFICATION

Please verify the payment receipt in the admin panel.
`;
            await bot.telegram.sendMessage(admin.telegramChatId, adminMsg, { parse_mode: 'HTML' });
          }
        }
      } catch (telegramErr) {
        console.error('Admin notification error:', telegramErr.message);
      }
    });
    
    res.json({
      message: 'Payment receipt uploaded successfully. Awaiting admin verification.',
      order: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        transactionId: order.transactionId
      }
    });
    
  } catch (error) {
    console.error('Receipt upload error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Verify payment - admin only with state machine
 */
exports.verifyPayment = async (req, res) => {
  try {
    const { orderId, status, notes } = req.body;
    const adminId = req.user.id || req.user._id;
    
    // Only admin can verify payments
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can verify payments' });
    }
    
    // Find order
    const order = await Order.findById(orderId).populate('user');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Validate status
    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Use "verified" or "rejected"' });
    }
    
    // Check if operation can be performed (idempotency)
    const operationCheck = canPerformOperation(order, status === 'verified' ? 'verify_payment' : 'reject_payment');
    if (!operationCheck.canProceed) {
      return res.status(400).json({ message: operationCheck.reason });
    }
    
    // Prepare transitions based on status
    let transitions;
    if (status === 'verified') {
      transitions = {
        paymentStatus: 'verified',
        escrowStatus: 'held'
      };
    } else {
      transitions = {
        paymentStatus: 'rejected',
        escrowStatus: 'none'
      };
    }
    
    // Use state machine for transition
    const transitionResult = await transitionOrderState(
      order, 
      transitions, 
      adminId, 
      { note: notes || `Payment ${status} by admin` }
    );
    
    if (!transitionResult.success) {
      return res.status(400).json({ 
        message: 'Failed to update payment status', 
        errors: transitionResult.errors 
      });
    }
    
    // If rejected, clear receipt data
    if (status === 'rejected') {
      order.receiptImage = '';
      order.receiptFilename = '';
      order.transactionId = '';
    }
    
    // If verified, calculate and snapshot commission amounts
    if (status === 'verified') {
      const commissionRate = order.commissionRate || Number(process.env.PLATFORM_COMMISSION_RATE || 10);
      const totalCommission = calculateCommission(order.totalAmount, commissionRate);
      
      order.commissionRate = commissionRate;
      order.commissionAmount = totalCommission.commissionAmount;
      order.sellerPayoutAmount = totalCommission.netAmount;
      
      // Calculate per-seller payouts
      const sellerPayouts = calculateSellerPayouts(order.items, commissionRate);
      
      // Update items with payout information
      order.items = order.items.map(item => {
        const sellerPayout = sellerPayouts.find(p => String(p.seller) === String(item.seller));
        if (sellerPayout) {
          const itemSubtotal = item.price * item.quantity;
          const itemCommission = calculateCommission(itemSubtotal, commissionRate);
          
          // Get seller's payout account info at this moment
          return item;
        }
        return item;
      });
    }
    
    await order.save();
    
    // Notify buyer via Telegram (non-blocking)
    setImmediate(async () => {
      try {
        const bot = require('../bot');
        if (order.user && order.user.telegramChatId && bot && bot.telegram) {
          let buyerMsg = '';
          if (status === 'verified') {
            buyerMsg = `
✅ <b>PAYMENT VERIFIED</b>

Your payment for order <b>${order.orderNumber}</b> has been verified.
Amount: ${order.totalAmount} ETB
Status: <b>HELD IN ESCROW</b>

The payment will be released to the seller after you confirm delivery.
Commission: ${order.commissionRate}% (${order.commissionAmount} ETB)
`;
          } else {
            buyerMsg = `
❌ <b>PAYMENT REJECTED</b>

Your payment receipt for order <b>${order.orderNumber}</b> was rejected.
${notes ? `Reason: ${notes}` : ''}

Please upload a valid payment receipt or contact support.
`;
          }
          await bot.telegram.sendMessage(order.user.telegramChatId, buyerMsg, { parse_mode: 'HTML' });
        }
      } catch (telegramErr) {
        console.error('Buyer notification error:', telegramErr.message);
      }
    });
    
    res.json({
      message: `Payment ${status} successfully`,
      order: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        // Frontend compatibility mapping
        paymentStatusLegacy: order.paymentStatus === 'verified' ? 'Paid' : 
                          order.paymentStatus === 'receipt_submitted' ? 'Verification Pending' : 
                          order.paymentStatus === 'awaiting_payment' ? 'pending' : order.paymentStatus,
        escrowStatus: order.escrowStatus,
        commissionAmount: order.commissionAmount,
        sellerPayoutAmount: order.sellerPayoutAmount
      }
    });
    
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Telebirr callback handler (for future API integration)
 */
exports.telebirrCallback = async (req, res) => {
  try {
    // TODO: Implement Telebirr signature verification
    console.log('Telebirr Callback Data:', req.body);
    
    // TODO: Update order status based on callback data
    // TODO: Verify transaction ID uniqueness
    // TODO: Use state machine for status updates
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Telebirr callback error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get pending payments - admin only
 */
exports.getPendingPayments = async (req, res) => {
  try {
    // Only admin can view pending payments
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can view pending payments' });
    }
    
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    const pendingPayments = await Order.find({
      paymentStatus: 'receipt_submitted',
      receiptImage: { $ne: '' }
    })
    .populate('user', 'fullName phone telegramChatId')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
    
    const total = await Order.countDocuments({
      paymentStatus: 'receipt_submitted',
      receiptImage: { $ne: '' }
    });
    
    res.json({
      payments: pendingPayments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Get pending payments error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Process payout - admin only with idempotency
 */
exports.processPayout = async (req, res) => {
  try {
    const { orderId, payoutReference } = req.body;
    const adminId = req.user.id || req.user._id;
    
    // Only admin can process payouts
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can process payouts' });
    }
    
    // Find order
    const order = await Order.findById(orderId).populate('user items.seller');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Check if operation can be performed (idempotency)
    const operationCheck = canPerformOperation(order, 'process_payout');
    if (!operationCheck.canProceed) {
      // Already processed - return success for idempotency
      return res.json({
        message: 'Payout already processed',
        order: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          payoutStatus: order.payoutStatus,
          payoutReference: order.payoutReference,
          payoutPaidAt: order.payoutPaidAt
        }
      });
    }
    
    // Verify order is ready for payout
    if (order.payoutStatus !== 'ready_for_payout') {
      return res.status(400).json({ 
        message: `Order is not ready for payout. Current status: ${order.payoutStatus}` 
      });
    }
    
    // Ensure commission amounts are set
    if (!order.commissionAmount || order.commissionAmount === 0) {
      const commissionRate = order.commissionRate || Number(process.env.PLATFORM_COMMISSION_RATE || 10);
      const totalCommission = calculateCommission(order.totalAmount, commissionRate);
      
      order.commissionRate = commissionRate;
      order.commissionAmount = totalCommission.commissionAmount;
      order.sellerPayoutAmount = totalCommission.netAmount;
    }
    
    // Use state machine for transition
    const transitions = {
      payoutStatus: 'paid_to_seller'
    };
    
    const transitionResult = await transitionOrderState(
      order, 
      transitions, 
      adminId, 
      { note: `Payout processed with reference: ${payoutReference}` }
    );
    
    if (!transitionResult.success) {
      return res.status(400).json({ 
        message: 'Failed to process payout', 
        errors: transitionResult.errors 
      });
    }
    
    // Set payout details
    order.payoutPaidAt = new Date();
    order.payoutReference = payoutReference || `PAY-${Date.now()}-${order.orderNumber}`;
    
    await order.save();
    
    // Calculate per-seller payouts for notification
    const sellerPayouts = calculateSellerPayouts(order.items, order.commissionRate);
    
    // Notify sellers via Telegram (non-blocking)
    setImmediate(async () => {
      try {
        const bot = require('../bot');
        
        for (const payout of sellerPayouts) {
          const seller = await User.findById(payout.seller).lean();
          if (seller && seller.telegramChatId && bot && bot.telegram) {
            const sellerMsg = `
💸 <b>PAYOUT PROCESSED</b>

Your payout for order <b>${order.orderNumber}</b> has been processed.
<b>Total Sales:</b> ${payout.subtotal} ETB
<b>Platform Commission (${order.commissionRate}%):</b> ${payout.commissionAmount} ETB
<b>Net Payout:</b> <b>${payout.netPayoutAmount} ETB</b>

Reference: ${order.payoutReference}
The amount has been transferred to your account.
`;
            await bot.telegram.sendMessage(seller.telegramChatId, sellerMsg, { parse_mode: 'HTML' });
          }
        }
      } catch (telegramErr) {
        console.error('Seller payout notification error:', telegramErr.message);
      }
    });
    
    res.json({
      message: 'Payout processed successfully',
      order: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        payoutStatus: order.payoutStatus,
        payoutReference: order.payoutReference,
        payoutPaidAt: order.payoutPaidAt
      },
      payoutDetails: {
        totalAmount: order.totalAmount,
        commissionRate: order.commissionRate,
        commissionAmount: order.commissionAmount,
        sellerPayoutAmount: order.sellerPayoutAmount,
        payoutReference: order.payoutReference,
        payoutPaidAt: order.payoutPaidAt,
        sellerPayouts
      }
    });
    
  } catch (error) {
    console.error('Payout processing error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get ready payouts - admin only with pagination
 */
exports.getReadyPayouts = async (req, res) => {
  try {
    // Only admin can view ready payouts
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can view ready payouts' });
    }
    
    const { page = 1, limit = 20, sellerId } = req.query;
    const skip = (page - 1) * limit;
    
    const filter = {
      payoutStatus: 'ready_for_payout',
      paymentStatus: 'verified',
      orderStatus: 'delivered'
    };
    
    if (sellerId) {
      filter['items.seller'] = sellerId;
    }
    
    const readyPayouts = await Order.find(filter)
      .populate('user', 'fullName phone')
      .populate('items.seller', 'fullName sellerTelebirr sellerCbeAccount sellerBankName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Order.countDocuments(filter);
    
    res.json({
      payouts: readyPayouts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Get ready payouts error:', error);
    res.status(500).json({ message: error.message });
  }
};
