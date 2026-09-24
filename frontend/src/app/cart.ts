import { Injectable, signal, computed, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface CartItem {
  _id: string;
  name: string;
  price: number;
  imageUrl: string;
  category?: string;
  sellerName?: string;
  telegramHandle?: string;
  quantity: number;
  stock?: number;
  selectedColor?: string;
  description?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private platformId = inject(PLATFORM_ID);

  items = signal<CartItem[]>(this.getInitialCart());

  totalCount = computed(() => {
    return this.items().reduce((sum, item) => sum + item.quantity, 0);
  });

  // Alias for template calls to cartService.itemCount()
  itemCount(): number {
    return this.totalCount();
  }

  subtotal = computed(() => {
    return this.items().reduce((sum, item) => sum + (item.price * item.quantity), 0);
  });

  deliveryFee = computed(() => {
    const sub = this.subtotal();
    if (sub === 0) return 0;
    return sub >= 1000 ? 0 : 150;
  });

  totalAmount = computed(() => {
    return this.subtotal() + this.deliveryFee();
  });

  private getVariantStock(product: any, selectedColor?: string): number {
    const normalizedColor = (selectedColor || product?.selectedColor || product?.color || '').toString().trim();
    const colors = Array.isArray(product?.colors) ? product.colors : [];
    if (normalizedColor && colors.length > 0) {
      const match = colors.find((color: any) => String(color?.name || '').trim().toLowerCase() === normalizedColor.toLowerCase());
      if (match) return Number(match.stock ?? 0);
    }
    return Number(product?.stock ?? 0);
  }

  addToCart(product: any, quantity: number = 1, selectedColor?: string) {
    const current = this.items();
    const chosenColor = (selectedColor || product?.selectedColor || product?.color || '').toString().trim();
    const existingIndex = current.findIndex(item => item._id === product._id && (item.selectedColor || '') === chosenColor);

    let updated: CartItem[];
    if (existingIndex > -1) {
      updated = current.map((item, idx) =>
        idx === existingIndex ? { ...item, quantity: item.quantity + quantity } : item
      );
    } else {
      updated = [
        ...current,
        {
          _id: product._id,
          name: product.name,
          price: product.price,
          imageUrl: product.imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
          category: product.category,
          sellerName: product.sellerName,
          telegramHandle: product.telegramHandle,
          quantity: Math.max(1, quantity),
          stock: this.getVariantStock(product, chosenColor),
          selectedColor: chosenColor,
          description: product.description
        }
      ];
    }

    this.items.set(updated);
    this.persist(updated);
  }

  changeQuantity(item: CartItem, delta: number) {
    if (!item) return;
    this.updateQuantity(item._id, item.quantity + delta, item.selectedColor);
  }

  updateQuantity(productId: string, quantity: number, selectedColor?: string) {
    if (quantity <= 0) {
      this.removeFromCart({ _id: productId, selectedColor } as CartItem);
      return;
    }

    const updated = this.items().map(item =>
      item._id === productId && (item.selectedColor || '') === (selectedColor || '') ? { ...item, quantity } : item
    );
    this.items.set(updated);
    this.persist(updated);
  }

  removeFromCart(itemOrId: CartItem | string) {
    const id = typeof itemOrId === 'string' ? itemOrId : itemOrId._id;
    const color = typeof itemOrId === 'string' ? '' : (itemOrId.selectedColor || '');
    const updated = this.items().filter(item => !(item._id === id && (item.selectedColor || '') === color));
    this.items.set(updated);
    this.persist(updated);
  }

  clearCart() {
    this.items.set([]);
    this.persist([]);
  }

  private persist(cartItems: CartItem[]) {
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem('telegebeya_cart', JSON.stringify(cartItems));
      } catch (e) {
        console.error('Failed to save cart to localStorage', e);
      }
    }
  }

  private getInitialCart(): CartItem[] {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const saved = localStorage.getItem('telegebeya_cart');
        return saved ? JSON.parse(saved) : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  }
}