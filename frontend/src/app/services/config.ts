import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CURRENT_API_URLS } from '../constants/api.constants';

export interface AppConfig {
  telegramBotUsername: string;
  botDeepLinkBase: string;
  freeDeliveryThreshold: number;
  defaultDeliveryFee: number;
  paymentMethods: string[];
  marketplaceName: string;
  adminTelebirrNumber?: string;
  adminCbeAccount?: string;
}

const DEFAULT_CONFIG: AppConfig = {
  telegramBotUsername: 'TeleGebeya_Shop_bot',
  botDeepLinkBase: 'https://t.me/TeleGebeya_Shop_bot',
  freeDeliveryThreshold: 1000,
  defaultDeliveryFee: 150,
  paymentMethods: ['telebirr', 'cash_on_delivery', 'cbe_birr'],
  marketplaceName: 'TeleGebeya',
  adminTelebirrNumber: '0911000000',
  adminCbeAccount: '1000123456789'
};

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private configSignal = signal<AppConfig>(this.getCachedConfig());

  get config(): AppConfig {
    return this.configSignal();
  }

  get botUsername(): string {
    return this.configSignal().telegramBotUsername;
  }

  get botDeepLink(): string {
    return `https://t.me/${this.botUsername}`;
  }

  getTrackLink(orderCode: string): string {
    return `${this.botDeepLink}?start=track_${orderCode}`;
  }

  getSellerLink(handle?: string): string {
    const cleanHandle = (handle || this.botUsername).replace('@', '');
    return `https://t.me/${cleanHandle}`;
  }

  async loadConfig(): Promise<AppConfig> {
    try {
      const config = await firstValueFrom(this.http.get<AppConfig>(CURRENT_API_URLS.CONFIG));
      this.configSignal.set(config);
      this.cacheConfig(config);
      return config;
    } catch (e) {
      return DEFAULT_CONFIG;
    }
  }

  private cacheConfig(config: AppConfig) {
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem('tg_app_config', JSON.stringify(config));
      } catch {}
    }
  }

  private getCachedConfig(): AppConfig {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const saved = localStorage.getItem('tg_app_config');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return DEFAULT_CONFIG;
  }
}
