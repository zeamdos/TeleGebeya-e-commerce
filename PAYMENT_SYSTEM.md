# Payment System Implementation

## Overview
This payment system implements an escrow-based payment flow where buyers pay the admin via Telebirr or CBE Birr, and funds are released to sellers after delivery confirmation, minus the platform commission.

## Payment Flow

### 1. Order Creation
- Buyer creates an order with payment method (Telebirr, CBE Birr, or Cash on Delivery)
- Order is created with `escrowStatus: 'held'` and `payoutStatus: 'pending'`
- Commission is calculated based on `PLATFORM_COMMISSION_RATE` (default 10%)

### 2. Payment Instructions
- Buyer calls `/api/payment/checkout` to get payment instructions
- System provides admin payment details based on selected payment method:
  - **Telebirr**: Admin Telebirr number
  - **CBE Birr**: Admin CBE account number
  - **Cash on Delivery**: No advance payment required

### 3. Payment Receipt Upload
- Buyer uploads payment receipt via `/api/payment/upload-receipt`
- Order status changes to `paymentStatus: 'Verification Pending'`
- Admin receives Telegram notification for verification

### 4. Admin Verification
- Admin views pending payments via `/api/admin/payments/pending`
- Admin verifies or rejects payment via `/api/admin/payments/verify`
- **Verified**: `paymentStatus: 'Paid'`, funds held in escrow
- **Rejected**: `paymentStatus: 'Rejected'`, buyer must upload new receipt
- Buyer receives Telegram notification of verification result

### 5. Order Delivery
- Seller delivers order to buyer
- Buyer confirms delivery via order status update
- **Only after payment verification**: 
  - `escrowStatus: 'released'`
  - `payoutStatus: 'ready_for_payout'`
- If payment not verified, escrow remains held

### 6. Seller Payout
- Admin views ready payouts via `/api/admin/payments/ready-payouts`
- Admin processes payout via `/api/admin/payments/process-payout`
- System calculates:
  - Total amount from order items per seller
  - Platform commission (configurable rate)
  - Net payout amount
- Order status changes to `payoutStatus: 'paid_to_seller'`
- Seller receives Telegram notification with payout details

## API Endpoints

### Buyer Endpoints
- `POST /api/payment/checkout` - Get payment instructions
- `POST /api/payment/upload-receipt` - Upload payment receipt

### Admin Endpoints
- `GET /api/admin/payments/pending` - View pending payment verifications
- `POST /api/admin/payments/verify` - Verify or reject payment
- `GET /api/admin/payments/ready-payouts` - View orders ready for payout
- `POST /api/admin/payments/process-payout` - Process seller payouts

## Configuration

Add these environment variables to your `.env` file:

```env
# Payment Configuration
ADMIN_TELEBIRR_NUMBER=0911-123-456
ADMIN_CBE_ACCOUNT=1000123456789
PLATFORM_COMMISSION_RATE=10
```

## Database Schema Updates

The Order model already includes the necessary fields:
- `escrowStatus`: 'held', 'released', 'refunded'
- `payoutStatus`: 'pending', 'ready_for_payout', 'paid_to_seller', 'cancelled'
- `commissionRate`: Platform commission percentage
- `commissionAmount`: Calculated commission amount
- `sellerPayoutAmount`: Net amount to be paid to seller
- `payoutPaidAt`: Timestamp when payout was processed
- `payoutReference`: Reference number for the payout

## Security Features

1. **Admin-only endpoints**: Payment verification and payout processing restricted to admin users
2. **Escrow system**: Funds held until delivery confirmation
3. **Payment verification**: Admin must verify receipts before funds are released
4. **Telegram notifications**: Real-time notifications for all payment events
5. **Commission calculation**: Automatic commission deduction before payouts

## Telegram Notifications

The system sends automatic Telegram notifications for:
- New payment receipt uploads (to admin)
- Payment verification results (to buyer)
- Order delivery and escrow release (to seller)
- Payout processing (to seller)

## Future Enhancements

1. **API Integration**: Integrate with actual Telebirr/CBE APIs for automatic payment verification
2. **Bulk Payouts**: Add functionality to process multiple payouts at once
3. **Payout History**: Track all payout transactions
4. **Dispute Resolution**: Add system for handling payment disputes
5. **Multiple Payment Methods**: Support additional payment providers
6. **Automatic Payouts**: Schedule automatic payout processing for verified orders

## Testing

To test the payment flow:

1. Create an order with Telebirr payment method
2. Call `/api/payment/checkout` to get payment instructions
3. Upload a test payment receipt via `/api/payment/upload-receipt`
4. As admin, verify the payment via `/api/admin/payments/verify`
5. Update order status to 'delivered'
6. As admin, process the payout via `/api/admin/payments/process-payout`
7. Verify seller receives Telegram notification with payout details

## Notes

- Cash on Delivery orders bypass the payment verification step
- Commission is calculated per order and applied to each seller's portion
- The system supports multi-seller orders (each seller gets their respective payout)
- All monetary values are in Ethiopian Birr (ETB)
