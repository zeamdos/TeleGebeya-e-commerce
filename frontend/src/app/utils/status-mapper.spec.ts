import { describe, it, expect } from 'vitest';
import { StatusMapper } from './status-mapper';

describe('StatusMapper', () => {
  describe('mapPaymentStatus', () => {
    it('should map verified to Paid', () => {
      expect(StatusMapper.mapPaymentStatus('verified')).toBe('Paid');
    });

    it('should map receipt_submitted to Verification Pending', () => {
      expect(StatusMapper.mapPaymentStatus('receipt_submitted')).toBe('Verification Pending');
    });

    it('should map awaiting_payment to Pending', () => {
      expect(StatusMapper.mapPaymentStatus('awaiting_payment')).toBe('Pending');
    });

    it('should map rejected to Rejected', () => {
      expect(StatusMapper.mapPaymentStatus('rejected')).toBe('Rejected');
    });

    it('should handle unknown statuses', () => {
      expect(StatusMapper.mapPaymentStatus('unknown')).toBe('unknown');
    });
  });

  describe('mapOrderStatus', () => {
    it('should map pending to Pending', () => {
      expect(StatusMapper.mapOrderStatus('pending')).toBe('Pending');
    });

    it('should map confirmed to Accepted', () => {
      expect(StatusMapper.mapOrderStatus('confirmed')).toBe('Accepted');
    });

    it('should map shipping to Shipped', () => {
      expect(StatusMapper.mapOrderStatus('shipping')).toBe('Shipped');
    });

    it('should map delivered to Delivered', () => {
      expect(StatusMapper.mapOrderStatus('delivered')).toBe('Delivered');
    });

    it('should map cancelled to Canceled', () => {
      expect(StatusMapper.mapOrderStatus('cancelled')).toBe('Canceled');
    });

    it('should handle unknown statuses', () => {
      expect(StatusMapper.mapOrderStatus('unknown')).toBe('unknown');
    });
  });

  describe('normalizePaymentStatus', () => {
    it('should normalize Paid to verified', () => {
      expect(StatusMapper.normalizePaymentStatus('Paid')).toBe('verified');
    });

    it('should normalize Verification Pending to receipt_submitted', () => {
      expect(StatusMapper.normalizePaymentStatus('Verification Pending')).toBe('receipt_submitted');
    });

    it('should normalize Pending to awaiting_payment', () => {
      expect(StatusMapper.normalizePaymentStatus('Pending')).toBe('awaiting_payment');
    });

    it('should pass through already normalized values', () => {
      expect(StatusMapper.normalizePaymentStatus('verified')).toBe('verified');
    });
  });

  describe('normalizeOrderStatus', () => {
    it('should normalize Accepted to confirmed', () => {
      expect(StatusMapper.normalizeOrderStatus('Accepted')).toBe('confirmed');
    });

    it('should normalize Shipped to shipping', () => {
      expect(StatusMapper.normalizeOrderStatus('Shipped')).toBe('shipping');
    });

    it('should normalize Delivered to delivered', () => {
      expect(StatusMapper.normalizeOrderStatus('Delivered')).toBe('delivered');
    });

    it('should normalize Canceled to cancelled', () => {
      expect(StatusMapper.normalizeOrderStatus('Canceled')).toBe('cancelled');
    });

    it('should pass through already normalized values', () => {
      expect(StatusMapper.normalizeOrderStatus('confirmed')).toBe('confirmed');
    });
  });
});
