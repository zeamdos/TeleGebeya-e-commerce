import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { AuthService } from './services/auth';
import { DeliveryService } from './services/delivery';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { beforeEach, describe } from 'node:test';
import { expect, it, vi } from 'vitest';

describe('App', () => {
  let mockAuthService: any;
  let mockDeliveryService: any;

  beforeEach(async () => {
    // Create mock objects for injected services
    mockAuthService = {
      currentUser: signal(null)
    };

    mockDeliveryService = {
      searchProducts: vi.fn().mockReturnValue(of([])),
      saveAddress: vi.fn().mockReturnValue(of({ success: true }))
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: DeliveryService, useValue: mockDeliveryService }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have as title 'frontend'`, () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect((app as any).title()).toEqual('frontend');
  });
});
