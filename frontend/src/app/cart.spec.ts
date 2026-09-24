import { TestBed } from '@angular/core/testing';
import { CartService } from './cart';
import { beforeEach, describe, expect, it } from 'vitest';

describe('Cart', () => {
  let service: CartService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CartService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
