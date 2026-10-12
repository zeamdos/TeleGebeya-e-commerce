import { Component, inject, OnInit, signal, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth';
import { OrderService, Order } from '../../services/order';
import { ProductService, Product } from '../../services/product';
import { TranslationService } from '../../services/translation';
import { HttpClient } from '@angular/common/http';
import { CURRENT_API_URLS } from '../../constants/api.constants';
import { StatusMapper } from '../../utils/status-mapper';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './account.html'
})
export class AccountPage implements OnInit {
 
  private http = inject(HttpClient);
  private apiUrl = CURRENT_API_URLS.API_BASE;
  authService = inject(AuthService);
  orderService = inject(OrderService);
  productService = inject(ProductService);
  i18n = inject(TranslationService);

  @Output() goHome = new EventEmitter<void>();

  activeTab: 'profile' | 'orders' | 'seller' = 'profile';

  myOrders = signal<Order[]>([]);
  myProducts = signal<Product[]>([]);
  mySellerOrders = signal<Order[]>([]);
isLoadingSellerOrders = signal<boolean>(false);
  isLoadingOrders = signal<boolean>(false);
  isLoadingProducts = signal<boolean>(false);

  // New Product Form State
  isAddProductModalOpen = false;
  isSubmittingProduct = false;
  newProduct = {
    name: '',
    description: '',
    price: 0,
    stock: 10,
    category: 'Tech',
    imageUrl: '',
    telegramHandle: '',
    sellerName: ''
  };

  categories = [
    { value: 'Tech', label: 'Tech & Gadgets / ቴክኖሎጂ' },
    { value: 'Apparel', label: 'Apparel & Footwear / ልብሶችና ጫማዎች' },
    { value: 'Leather', label: 'Leather & Crafts / የቆዳ ውጤቶች' },
    { value: 'Home', label: 'Home & Coffee / የቤትና ቡና እቃዎች' },
    { value: 'Beauty', label: 'Beauty & Care / የውበት መጠበቂያ' }
  ];

  ngOnInit() {
    this.loadOrders();
    const user = this.authService.currentUser();
    if (user?.role === 'seller' || user?.role === 'admin') {
      this.loadMyProducts();
    }
  }

  switchTab(tab: 'profile' | 'orders' | 'seller') {
    this.activeTab = tab;
    if (tab === 'orders') {
      this.loadOrders();
    } else if (tab === 'seller') {
      this.loadMyProducts();
     this.loadSellerOrders();
    }
  }

  loadOrders() {
    this.isLoadingOrders.set(true);
    this.orderService.getMyOrders().subscribe({
      next: (orders) => {
        const mappedOrders = orders.map(order => ({
          ...order,
          paymentStatus: StatusMapper.mapPaymentStatus(order.paymentStatus) as Order['paymentStatus'],
          orderStatus: StatusMapper.mapOrderStatus(order.orderStatus) as Order['orderStatus']
        }));
        this.myOrders.set(mappedOrders);
        this.isLoadingOrders.set(false);
      },
      error: (err) => {
        console.error('Failed to load orders', err);
        this.isLoadingOrders.set(false);
      }
    });
  }

  markShipped(order: Order) {
  if (!order._id) return;
  const confirmMsg = this.i18n.isAmharic()
    ? 'ይህን ትእዛዝ እንደተላከ ምልክት ማድረግ ይፈልጋሉ?'
    : 'Mark this order as shipped?';
  if (!confirm(confirmMsg)) return;

  this.orderService.updateOrderStatus(order._id, { orderStatus: 'shipping' }).subscribe({
    next: (updated: any) => {
      const res = updated?.order || updated;
      this.mySellerOrders.update(list => list.map(o => o._id === order._id ? res : o));
    },
    error: (err) => {
      alert(err.error?.message || 'Failed to mark order as shipped.');
    }
  });
}

loadSellerOrders() {
  this.isLoadingSellerOrders.set(true);
  this.orderService.getSellerOrders().subscribe({
    next: (orders) => {
      const mappedOrders = orders.map(order => ({
        ...order,
        paymentStatus: StatusMapper.mapPaymentStatus(order.paymentStatus) as Order['paymentStatus'],
        orderStatus: StatusMapper.mapOrderStatus(order.orderStatus) as Order['orderStatus']
      }));
      this.mySellerOrders.set(mappedOrders);
      this.isLoadingSellerOrders.set(false);
    },
    error: (err) => {
      console.error('Failed to load seller orders', err);
      this.isLoadingSellerOrders.set(false);
    }
  });
}

canMarkShipped(order: Order): boolean {
    const normalized = StatusMapper.normalizeOrderStatus(order.orderStatus || '');
  return normalized === 'pending' || normalized === 'confirmed';
}

  loadMyOrders(): void {
    this.isLoadingOrders.set(true);
    this.orderService.getMyOrders().subscribe({
      next: (orders) => {
        const mappedOrders = orders.map(order => ({
          ...order,
          paymentStatus: StatusMapper.mapPaymentStatus(order.paymentStatus) as Order['paymentStatus'],
          orderStatus: StatusMapper.mapOrderStatus(order.orderStatus) as Order['orderStatus']
        }));
        this.myOrders.set(mappedOrders);
        this.isLoadingOrders.set(false);
      },
      error: (err) => {
        console.error('Failed to load orders:', err);
        this.isLoadingOrders.set(false);
      }
    });
  }

  updateStatus(orderId: string, status: string): void {
    if (!orderId) return;

    const confirmMsg = this.i18n.isAmharic()
      ? `እርግጠኛ ነዎት ይህን ትእዛዝ ወደ ${status} መቀየር ይፈልጋሉ?`
      : `Are you sure you want to mark this order as ${status}?`;

    if (!confirm(confirmMsg)) {
      return;
    }

    this.orderService.updateOrderStatus(orderId, { orderStatus: status }).subscribe({
      next: () => {
        alert(this.i18n.isAmharic() ? `የትእዛዝ ሁኔታ ወደ ${status} ተቀይሯል` : `Order status updated to ${status}`);
        this.loadOrders();
      },
      error: (err) => {
        console.error('Failed to update status:', err);
        alert(err.error?.message || 'Failed to update order status');
      }
    });
  }

  loadMyProducts() {
    this.isLoadingProducts.set(true);
    this.productService.getMyProducts().subscribe({
      next: (products) => {
        this.myProducts.set(products);
        this.isLoadingProducts.set(false);
      },
      error: (err) => {
        console.error('Failed to load seller products', err);
        this.isLoadingProducts.set(false);
      }
    });
  }

  openAddProductModal() {
    const user = this.authService.currentUser();
    this.newProduct = {
      name: '',
      description: '',
      price: 1500,
      stock: 20,
      category: 'Tech',
      imageUrl: '',
      telegramHandle: user?.telegramHandle || '@mytelegramshop',
      sellerName: user?.shopName || user?.fullName || 'Verified Seller'
    };
    this.isAddProductModalOpen = true;
  }

  closeAddProductModal() {
    this.isAddProductModalOpen = false;
  }

  submitProduct() {
      if (this.isSubmittingProduct) return;

    if (!this.newProduct.name || !this.newProduct.price) {
      alert('Please provide product name and price');
      return;
    }

    if (!this.newProduct.imageUrl) {
      this.newProduct.imageUrl = 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80';
    }
      this.isSubmittingProduct = true;

    this.productService.createProduct(this.newProduct).subscribe({
      next: (created) => {
          this.isSubmittingProduct = false;
        this.closeAddProductModal();
        this.myProducts.update(list => [created, ...list]);
        alert(this.i18n.isAmharic() ? 'ዕቃው በተሳካ ሁኔታ ተለጥፏል!' : 'Product listed successfully!');
      },
      error: (err) => {
         this.isSubmittingProduct = false;
        console.error('Failed to create product', err);
        alert('Failed to publish product: ' + (err.error?.message || err.message));
      }
    });
  }

  confirmDelivery(order: Order) {
    if (!order._id) return;
    const confirmMsg = this.i18n.isAmharic()
      ? 'ይህን ትእዛዝ እንደደረሰዎት ያረጋግጡ?'
      : 'Confirm you received this order?';
    if (!confirm(confirmMsg)) return;

    this.orderService.updateOrderStatus(order._id, { orderStatus: 'delivered' }).subscribe({
      next: (updated: any) => {
        const res = updated?.order || updated;
        this.myOrders.update(list => list.map(o => o._id === order._id ? res : o));
        this.loadOrders();
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to confirm delivery.');
      }
    });
  }

  cancelOrder(order: Order) {
    if (!order._id) return;
    const confirmMsg = this.i18n.isAmharic()
      ? 'እርግጠኛ ነዎት ትእዛዙን መሰረዝ ይፈልጋሉ? እቃው ወዲያውኑ ወደ ክምችት ይመለሳል።'
      : 'Are you sure you want to cancel this order? The item will be restocked immediately.';
    if (!confirm(confirmMsg)) return;

    this.orderService.updateOrderStatus(order._id, { orderStatus: 'cancelled' }).subscribe({
      next: (updated: any) => {
        const res = updated?.order || updated;
        this.myOrders.update(list => list.map(o => o._id === order._id ? res : o));
        this.loadOrders();
        alert(this.i18n.isAmharic() ? 'ትእዛዙ ተሰርዟል፤ እቃው ወደ ክምችት ተመልሷል።' : 'Order cancelled and restocked successfully.');
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to cancel order.');
      }
    });
  }

canConfirmDelivery(order: Order): boolean {
   const normalized = StatusMapper.normalizeOrderStatus(order.orderStatus || '');
 return normalized === 'shipping' || normalized === 'confirmed';
}

canCancel(order: Order): boolean {
   const normalized = StatusMapper.normalizeOrderStatus(order.orderStatus || '');
  return normalized === 'pending' || normalized === 'confirmed';
}

formatOrderStatus(status: string): string {
  return StatusMapper.mapOrderStatus(status);
}

formatPaymentStatus(status: string): string {
  return StatusMapper.mapPaymentStatus(status);
}

  deleteProduct(id: string) {
    const confirmMsg = this.i18n.isAmharic() 
      ? 'እርግጠኛ ነዎት ይህን ዕቃ መሰረዝ ይፈልጋሉ?' 
      : 'Are you sure you want to delete this listing?';
    
    if (confirm(confirmMsg)) {
      this.productService.deleteProduct(id).subscribe({
        next: () => {
          this.myProducts.update(list => list.filter(p => p._id !== id));
        },
        error: (err) => console.error('Failed to delete product', err)
      });
    }
  }

  handleLogout() {
    this.authService.logout();
    this.goHome.emit();
  }

  getTelegramTrackLink(order: Order): string {
    const code = order.orderNumber || order._id || 'recent';
    return `https://t.me/TeleGebeya_Shop_bot?start=track_${code}`;
  }
}
