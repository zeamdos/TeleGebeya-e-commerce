/**
 * Order State Machine
 * Production-grade state management for order payment, escrow, and payout transitions
 * 
 * Design Principles:
 * - Single source of truth for valid state transitions
 * - Idempotent operations (safe to retry)
 * - Comprehensive audit trail
 * - Strong validation and error handling
 * - Scalable and maintainable
 */

const VALID_TRANSITIONS = {
  // Payment Status Transitions
  paymentStatus: {
    awaiting_payment: ['receipt_submitted', 'verified' ,'rejected'],
    receipt_submitted: ['verified', 'rejected'],
    verified: [], // Terminal state
    rejected: ['receipt_submitted'] // Can retry with new receipt
  },
  
  // Escrow Status Transitions
  escrowStatus: {
    none: ['held', 'released', 'refunded'],
    held: ['released', 'refunded'],
    released: [], // Terminal state
    refunded: [] // Terminal state
  },
  
  // Payout Status Transitions
  payoutStatus: {
    pending: ['ready_for_payout', 'cancelled'],
    ready_for_payout: ['paid_to_seller', 'cancelled'],
    paid_to_seller: [], // Terminal state
    cancelled: [] // Terminal state
  },
  
  // Order Status Transitions
  orderStatus: {
    pending: ['confirmed', 'shipping', 'delivered','cancelled'],
    confirmed: ['shipping', 'delivered','cancelled'],
    shipping: ['delivered', 'cancelled'],
    delivered: [], // Terminal state
    cancelled: [] // Terminal state
  }
};

const TERMINAL_STATES = {
  paymentStatus: ['verified'],
  escrowStatus: ['released', 'refunded'],
  payoutStatus: ['paid_to_seller', 'cancelled'],
  orderStatus: ['delivered', 'cancelled']
};

/**
 * Validate if a state transition is valid
 * @param {string} stateType - Type of state (paymentStatus, escrowStatus, etc.)
 * @param {string} currentState - Current state value
 * @param {string} targetState - Target state value
 * @returns {boolean} - Whether transition is valid
 */
function isValidTransition(stateType, currentState, targetState) {
  if (!currentState || !targetState) return false;
  if (currentState === targetState) return true; // Idempotent: same state is valid
  
  const transitions = VALID_TRANSITIONS[stateType];
  if (!transitions) return false;
  
  const validTargets = transitions[currentState];
  return validTargets && validTargets.includes(targetState);
}

/**
 * Check if a state is terminal (no further transitions allowed)
 * @param {string} stateType - Type of state
 * @param {string} state - State value to check
 * @returns {boolean} - Whether state is terminal
 */
function isTerminalState(stateType, state) {
  const terminals = TERMINAL_STATES[stateType];
  return terminals && terminals.includes(state);
}

/**
 * Validate multiple state transitions in a single operation
 * @param {Object} transitions - Object with stateType: {from, to} pairs
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateTransitions(transitions) {
  const errors = [];
  
  for (const [stateType, { from, to }] of Object.entries(transitions)) {
    if (!isValidTransition(stateType, from, to)) {
      errors.push(
        `Invalid ${stateType} transition: ${from} -> ${to}. ` +
        `Valid transitions from ${from}: ${VALID_TRANSITIONS[stateType]?.[from]?.join(', ') || 'none'}`
      );
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Add status history entry to order
 * @param {Object} order - Order document
 * @param {string} stateType - Type of state that changed
 * @param {string} oldState - Previous state value
 * @param {string} newState - New state value
 * @param {string} actor - ID of user who made the change
 * @param {string} note - Optional note about the change
 */
function addStatusHistory(order, stateType, oldState, newState, actor, note = '') {
  if (!order.statusHistory) {
    order.statusHistory = [];
  }
  
  order.statusHistory.push({
    stateType,
    oldState,
    newState,
    actor,
    note,
    timestamp: new Date()
  });
  
  // Keep history manageable - last 50 entries
  if (order.statusHistory.length > 50) {
    order.statusHistory = order.statusHistory.slice(-50);
  }
}

/**
 * Business rule: Escrow can only be held after payment verification
 * @param {Object} order - Order document
 * @param {string} targetEscrowStatus - Target escrow status
 * @returns {boolean} - Whether transition is allowed by business rules
 */
function canTransitionEscrow(order, targetEscrowStatus) {
  // Escrow can only be held if payment is verified
  if (targetEscrowStatus === 'held') {
    const isPaymentVerified = order.paymentStatus === 'verified';
    if (!isPaymentVerified) {
      return false;
    }
  }
  
  // Escrow can only be released if order is delivered
  if (targetEscrowStatus === 'released') {
    const isOrderDelivered = order.orderStatus === 'delivered';
    if (!isOrderDelivered) {
      return false;
    }
  }
  
  return true;
}

/**
 * Business rule: Payout can only be ready if escrow is released
 * @param {Object} order - Order document
 * @param {string} targetPayoutStatus - Target payout status
 * @returns {boolean} - Whether transition is allowed by business rules
 */
function canTransitionPayout(order, targetPayoutStatus) {
  // Payout can only be ready if escrow is released
  if (targetPayoutStatus === 'ready_for_payout') {
    const isEscrowReleased = order.escrowStatus === 'released';
    if (!isEscrowReleased) {
      return false;
    }
  }
  
  // Payout can only be paid if it's ready
  if (targetPayoutStatus === 'paid_to_seller') {
    const isReady = order.payoutStatus === 'ready_for_payout';
    if (!isReady) {
      return false;
    }
  }
  
  return true;
}

/**
 * Business rule: Order can only be delivered if payment is verified (or COD)
 * @param {Object} order - Order document
 * @param {string} targetOrderStatus - Target order status
 * @returns {boolean} - Whether transition is allowed by business rules
 */
function canTransitionOrder(order, targetOrderStatus) {
  // Order can only be delivered if payment is verified or it's COD
  if (targetOrderStatus === 'delivered') {
    const isPaymentVerified = order.paymentStatus === 'verified';
    const isCashOnDelivery = order.paymentMethod === 'cash_on_delivery';
    
    if (!isPaymentVerified && !isCashOnDelivery) {
      return false;
    }
  }
  
  return true;
}

/**
 * Main state transition function with comprehensive validation
 * @param {Object} order - Order document
 * @param {Object} transitions - Object with stateType: targetState pairs
 * @param {string} actorId - ID of user making the change
 * @param {Object} metadata - Additional metadata (notes, etc.)
 * @returns {Object} - { success: boolean, order: Object, errors: string[] }
 */
async function transitionOrderState(order, transitions, actorId, metadata = {}) {
  const errors = [];
  const updates = {};
  const historyEntries = [];
  const { note = '' } = metadata;
  const stateView = {};

  for (const stateType of Object.keys(VALID_TRANSITIONS)) {
    stateView[stateType] = order[stateType];
  }
  
  // Validate each transition
  for (const [stateType, targetState] of Object.entries(transitions)) {
    const currentState = stateView[stateType];
    
    // Skip if already in target state (idempotent)
    if (currentState === targetState) {
      continue;
    }
    
    // Check if transition is valid
    if (!isValidTransition(stateType, currentState, targetState)) {
      errors.push(
        `Invalid ${stateType} transition: ${currentState} -> ${targetState}`
      );
      continue;
    }
    
    // Check business rules
    const orderView = { ...order, ...stateView };

    if (stateType === 'escrowStatus' && !canTransitionEscrow(orderView, targetState)) {
      errors.push(
        `Business rule violation: Cannot transition escrow to ${targetState} ` +
        `without meeting prerequisites`
      );
      continue;
    }
    
    if (stateType === 'payoutStatus' && !canTransitionPayout(orderView, targetState)) {
      errors.push(
        `Business rule violation: Cannot transition payout to ${targetState} ` +
        `without meeting prerequisites`
      );
      continue;
    }
    
    if (stateType === 'orderStatus' && !canTransitionOrder(orderView, targetState)) {
      errors.push(
        `Business rule violation: Cannot transition order to ${targetState} ` +
        `without meeting prerequisites`
      );
      continue;
    }
    
    // Add to updates
    updates[stateType] = targetState;
    stateView[stateType] = targetState;
    
    // Add audit fields based on transition type
    if (stateType === 'paymentStatus' && targetState === 'verified') {
      updates.verifiedBy = actorId;
      updates.verifiedAt = new Date();
    }
    
    if (stateType === 'paymentStatus' && targetState === 'rejected') {
      updates.rejectionReason = note;
    }
    
    if (stateType === 'escrowStatus' && targetState === 'released') {
      updates.releasedAt = new Date();
    }
    
    if (stateType === 'payoutStatus' && targetState === 'paid_to_seller') {
      updates.payoutPaidBy = actorId;
      updates.payoutPaidAt = new Date();
    }
    
    historyEntries.push({ stateType, oldState: currentState, newState: targetState });
  }
  
  if (errors.length > 0) {
    return {
      success: false,
      errors,
      order
    };
  }
  
  // Apply updates
  Object.assign(order, updates);
  for (const entry of historyEntries) {
    addStatusHistory(order, entry.stateType, entry.oldState, entry.newState, actorId, note);
  }
  
  return {
    success: true,
    order,
    appliedTransitions: Object.keys(updates)
  };
}

/**
 * Check if an operation can be performed (idempotency check)
 * @param {Object} order - Order document
 * @param {string} operation - Operation type
 * @returns {Object} - { canProceed: boolean, reason: string }
 */
function canPerformOperation(order, operation) {
  switch (operation) {
    case 'verify_payment':
      if (order.paymentStatus === 'verified') {
        return { canProceed: false, reason: 'Payment already verified' };
      }
      if (order.paymentStatus !== 'receipt_submitted') {
        return { canProceed: false, reason: 'No receipt submitted for verification' };
      }
      break;
      
    case 'reject_payment':
      if (order.paymentStatus === 'rejected') {
        return { canProceed: false, reason: 'Payment already rejected' };
      }
      if (order.paymentStatus === 'verified') {
        return { canProceed: false, reason: 'Cannot reject verified payment' };
      }
      break;
      
    case 'confirm_delivery':
      if (order.orderStatus === 'delivered') {
        return { canProceed: false, reason: 'Order already delivered' };
      }
      if (order.orderStatus === 'cancelled') {
        return { canProceed: false, reason: 'Cannot deliver cancelled order' };
      }
      break;
      
    case 'process_payout':
      if (order.payoutStatus === 'paid_to_seller') {
        return { canProceed: false, reason: 'Payout already processed' };
      }
      if (order.payoutStatus !== 'ready_for_payout') {
        return { canProceed: false, reason: 'Order not ready for payout' };
      }
      break;
      
    case 'cancel_order':
      if (order.orderStatus === 'cancelled') {
        return { canProceed: false, reason: 'Order already cancelled' };
      }
      if (order.orderStatus === 'delivered') {
        return { canProceed: false, reason: 'Cannot cancel delivered order' };
      }
      if (order.payoutStatus === 'paid_to_seller') {
        return { canProceed: false, reason: 'Cannot cancel order after payout' };
      }
      break;
      
    default:
      return { canProceed: false, reason: 'Unknown operation' };
  }
  
  return { canProceed: true };
}

module.exports = {
  VALID_TRANSITIONS,
  TERMINAL_STATES,
  isValidTransition,
  isTerminalState,
  validateTransitions,
  addStatusHistory,
  canTransitionEscrow,
  canTransitionPayout,
  canTransitionOrder,
  transitionOrderState,
  canPerformOperation
};
