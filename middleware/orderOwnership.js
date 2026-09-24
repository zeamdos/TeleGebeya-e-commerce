/**
 * Order Ownership & Access Control Middleware
 * Production-grade authorization for order operations
 * 
 * Security Principles:
 * - Defense in depth: Multiple layers of authorization
 * - Principle of least privilege: Users only access what they need
 * - Role-based access control: Clear separation of concerns
 * - Audit logging: Track who accessed what
 * - Scalable architecture: Easy to extend and maintain
 */

const Order = require('../models/Order');
const User = require('../models/user');

/**
 * Check if user owns the order
 * @param {Object} order - Order document
 * @param {Object} user - User object from request
 * @returns {boolean} - Whether user owns the order
 */
function isOrderOwner(order, user) {
  if (!order || !user) return false;
  
  const userId = user.id || user._id;
  const orderUserId = order.user || order.buyer;
  
  // Check direct ownership
  if (String(orderUserId) === String(userId)) {
    return true;
  }
  
  // Check phone number match (for guest orders)
  if (order.phone && user.phone) {
    const orderPhone = order.phone.replace(/\D/g, '').slice(-9);
    const userPhone = user.phone.replace(/\D/g, '').slice(-9);
    if (orderPhone === userPhone) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if user is a seller for any items in the order
 * @param {Object} order - Order document
 * @param {Object} user - User object from request
 * @returns {boolean} - Whether user is a seller for this order
 */
function isOrderSeller(order, user) {
  if (!order || !user || !order.items) return false;
  
  const userId = user.id || user._id;
  
  return order.items.some(item => 
    String(item.seller) === String(userId)
  );
}

/**
 * Check if user has admin privileges
 * @param {Object} user - User object from request
 * @returns {boolean} - Whether user is admin
 */
function isAdmin(user) {
  return user && user.role === 'admin';
}

/**
 * Middleware to verify user can view order
 * - Buyers can view their own orders
 * - Sellers can view orders containing their items
 * - Admins can view all orders
 */
async function canViewOrder(req, res, next) {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    const user = req.user;
    
    // Admin can view all orders
    if (isAdmin(user)) {
      req.order = order;
      return next();
    }
    
    // Buyer can view own orders
    if (isOrderOwner(order, user)) {
      req.order = order;
      return next();
    }
    
    // Seller can view orders containing their items
    if (isOrderSeller(order, user)) {
      // Filter to show only seller's items
      req.order = order;
      req.isSellerView = true;
      return next();
    }
    
    return res.status(403).json({ 
      message: 'You do not have permission to view this order' 
    });
    
  } catch (error) {
    console.error('Order view authorization error:', error);
    return res.status(500).json({ message: 'Authorization check failed' });
  }
}

/**
 * Middleware to verify user can modify order
 * - Only order owner (buyer) can confirm delivery
 * - Only admin can perform admin operations
 * - Sellers can update order status (shipping, etc.)
 */
async function canModifyOrder(req, res, next) {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    const user = req.user;
    const operation = req.body.operation || req.method;
    const rawStatus = req.body.orderStatus || req.body.status || '';
    const normalizedStatus = String(rawStatus).trim().toLowerCase();
    const targetIsDelivered = normalizedStatus === 'delivered';
    const targetIsCancelled = ['cancelled', 'canceled'].includes(normalizedStatus);
    
    // Admin can modify any order
    if (isAdmin(user)) {
      req.order = order;
      return next();
    }
    
    // Buyer can confirm delivery or cancel own order
    if (isOrderOwner(order, user)) {
      const allowedOperations = ['confirm_delivery', 'cancel_order'];
      if (allowedOperations.includes(operation) || 
         targetIsDelivered ||
         targetIsCancelled) {
        req.order = order;
        return next();
      }
    }
    
    // Seller can update shipping status for their items
    if (isOrderSeller(order, user)) {
      const allowedStatuses = ['shipping', 'shipped'];
      if (allowedStatuses.includes(normalizedStatus)) {
        req.order = order;
        return next();
      }
    }
    
    return res.status(403).json({ 
      message: 'You do not have permission to modify this order' 
    });
    
  } catch (error) {
    console.error('Order modify authorization error:', error);
    return res.status(500).json({ message: 'Authorization check failed' });
  }
}

/**
 * Middleware to verify user can access payment operations
 * - Only order owner can upload receipts
 * - Only admin can verify/reject payments
 */
async function canAccessPayment(req, res, next) {
  try {
    const order = await Order.findById(req.params.id || req.body.orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    const user = req.user;
    const action = req.body.action || req.path.split('/').pop();
    
    // Admin can perform all payment operations
    if (isAdmin(user)) {
      req.order = order;
      return next();
    }
    
    // Order owner can upload receipt
    if (isOrderOwner(order, user)) {
      const allowedActions = ['upload-receipt', 'uploadReceipt'];
      if (allowedActions.includes(action)) {
        req.order = order;
        return next();
      }
    }
    
    return res.status(403).json({ 
      message: 'You do not have permission to perform this payment operation' 
    });
    
  } catch (error) {
    console.error('Payment access authorization error:', error);
    return res.status(500).json({ message: 'Authorization check failed' });
  }
}

/**
 * Middleware to verify user can access payout operations
 * - Only admin can process payouts
 * - Sellers can view their own payout status
 */
async function canAccessPayout(req, res, next) {
  try {
    const user = req.user;
    
    // Admin can access all payout operations
    if (isAdmin(user)) {
      return next();
    }
    
    // Sellers can only view their own payout status
    if (user.role === 'seller') {
      // For GET requests, they can view their payouts
      if (req.method === 'GET') {
        return next();
      }
    }
    
    return res.status(403).json({ 
      message: 'You do not have permission to access payout operations' 
    });
    
  } catch (error) {
    console.error('Payout access authorization error:', error);
    return res.status(500).json({ message: 'Authorization check failed' });
  }
}

/**
 * Middleware to filter sensitive data from order responses
 * - Remove seller account info from non-admin responses
 * - Remove internal audit fields from buyer responses
 */
function filterSensitiveData(req, res, next) {
  const originalJson = res.json;
  
  res.json = function(data) {
    let filteredData = data;
    
    // If returning order data, filter based on user role
    if (data.order || (data._id && data.items)) {
      const order = data.order || data;
      const user = req.user;
      
      // Non-admin users shouldn't see seller account details
      if (!isAdmin(user)) {
        if (order.items) {
          order.items = order.items.map(item => ({
            ...item,
            seller: item.seller ? {
              _id: item.seller._id,
              fullName: item.seller.fullName,
              shopName: item.seller.shopName
            } : item.seller
          }));
        }
      }
      
      // Buyers shouldn't see internal audit fields
      if (!isAdmin(user) && isOrderOwner(order, user)) {
        delete order.verifiedBy;
        delete order.payoutPaidBy;
        delete order.statusHistory;
      }
      
      filteredData = data.order ? { ...data, order } : order;
    }
    
    return originalJson.call(this, filteredData);
  };
  
  next();
}

/**
 * Middleware to log order access for audit trail
 */
function logOrderAccess(req, res, next) {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log access in production (implement proper logging service)
    if (process.env.NODE_ENV === 'production') {
      console.log(`Order Access: User ${req.user?.id} accessed order ${req.params.id} via ${req.method} ${req.path}`);
    }
    
    return originalSend.call(this, data);
  };
  
  next();
}

module.exports = {
  isOrderOwner,
  isOrderSeller,
  isAdmin,
  canViewOrder,
  canModifyOrder,
  canAccessPayment,
  canAccessPayout,
  filterSensitiveData,
  logOrderAccess
};