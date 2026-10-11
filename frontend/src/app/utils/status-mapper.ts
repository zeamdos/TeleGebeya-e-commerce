export class StatusMapper {
  static mapPaymentStatus(status: string): string {
    const map: Record<string, string> = {
      'verified': 'Paid',
      'receipt_submitted': 'Verification Pending',
      'awaiting_payment': 'pending',
      'rejected': 'Rejected',
      'paid': 'Paid',
      'failed': 'Rejected',
      'unpaid': 'pending'
    };
    return map[status] || status;
  }

  static mapOrderStatus(status: string): string {
    const map: Record<string, string> = {
      'confirmed': 'Accepted',
      'shipping': 'Shipped',
      'delivered': 'Delivered',
      'cancelled': 'Canceled',
      'accepted': 'Accepted',
      'shipped': 'Shipped',
      'canceled': 'Canceled'
    };
    return map[status] || status;
  }

  static normalizePaymentStatus(status: string): string {
    const map: Record<string, string> = {
      'paid': 'verified',
      'Paid': 'verified',
      'Verification Pending': 'receipt_submitted',
      'verification pending': 'receipt_submitted',
      'pending': 'awaiting_payment',
      'failed': 'rejected',
      'Rejected': 'rejected',
      'unpaid': 'awaiting_payment',
      'Unpaid': 'awaiting_payment'
    };
    return map[status] || status;
  }

  static normalizeOrderStatus(status: string): string {
    const map: Record<string, string> = {
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
    return map[status] || status;
  }
}
