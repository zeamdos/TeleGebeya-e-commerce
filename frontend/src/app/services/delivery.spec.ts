import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { DeliveryService } from './delivery';
import { describe, beforeEach, it, expect } from 'vitest';

describe('DeliveryService', () => {
  let service: DeliveryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()]
    });
    service = TestBed.inject(DeliveryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
