import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { OrderService } from './order';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('OrderService', () => {
  let service: OrderService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [OrderService]
    });

    service = TestBed.inject(OrderService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call correct payment verification endpoint', () => {
    const orderId = 'test-order-id';
    const status = 'verified';
    const notes = 'Payment confirmed';

    service.verifyPayment(orderId, status, notes).subscribe(response => {
      expect(response).toBeTruthy();
    });

    const req = httpMock.expectOne(req =>
      req.url.includes('/api/payment/verify-payment') &&
      req.method === 'POST'
    );

    expect(req.request.body).toEqual({
      orderId,
      status,
      notes
    });

    req.flush({ success: true });
    httpMock.verify();
  });

  it('should handle payment verification error', () => {
    const orderId = 'test-order-id';
    let errorReceived = false;

    service.verifyPayment(orderId, 'verified').subscribe({
      next: () => {
        errorReceived = false;
      },
      error: () => {
        errorReceived = true;
      }
    });

    const req = httpMock.expectOne('/api/payment/verify-payment');
    req.flush({ message: 'Verification failed' }, { status: 400, statusText: 'Bad Request' });
    httpMock.verify();

    expect(errorReceived).toBe(true);
  });
});
