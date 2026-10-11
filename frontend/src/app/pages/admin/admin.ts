import { Component, inject, OnInit, Output, EventEmitter, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../services/admin';
import { ProductService } from '../../services/product';
import { AuthService } from '../../services/auth';
import { TranslationService } from '../../services/translation';
import { OrderService } from '../../services/order';
import { FilterLowStockPipe } from './filter-low-stock.pipe';
import { StatusMapper } from '../../utils/status-mapper';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterLowStockPipe],
  templateUrl: './admin.html',
  styleUrls: ['./admin.css']
})
export class AdminPage implements OnInit {
  adminService = inject(AdminService);
  productService = inject(ProductService);
  authService = inject(AuthService);
  i18n = inject(TranslationService);
  orderService = inject(OrderService);

  @Output() goHome = new EventEmitter<void>();

  tab:any = 'overview';

  isLoading = signal(false);
  stats = signal<any>({
    users: 0,
    sellers: 0,
    products: 0,
    orders: 0,
    revenue: 0,
    lowStock: 0,
    pendingOrders: 0
  });

  users = signal<any[]>([]);
  products = signal<any[]>([]);
  orders = signal<any[]>([]);

  toast = signal<string>('');

  editProduct: any = null;
  isEditProductOpen = false;
  reviewOrder: any = null;
isReviewOrderOpen = false;

  constructor() {}

  ngOnInit(): void {
    this.refreshAll();
  }

  get isAmharic(): boolean { return this.i18n.isAmharic(); }

  goBackHome(): void { this.goHome.emit(); }

  private showToast(msg: string, dur = 2400): void {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), dur);
  }

  refreshAll(): void {
    this.isLoading.set(true);
    Promise.allSettled([
      this.loadStats(),
      this.loadUsers(),
      this.loadProducts(),
      this.loadOrders()
    ]).finally(() => this.isLoading.set(false));
  }

  private loadStats(): Promise<void> {
    return new Promise((resolve) => {
      this.adminService.getStats().subscribe({
        next: (data) => { this.stats.set(data); resolve(); },
        error: () => {
          this.stats.set({
            users: this.users().length,
            sellers: this.users().filter(u => u.role === 'seller').length,
            products: this.products().length,
            orders: this.orders().length,
            revenue: this.orders()
              .filter(o => StatusMapper.mapPaymentStatus(o.paymentStatus) === 'Paid' || o.orderStatus === 'delivered')
              .reduce((s, o) => s + (o.totalAmount || 0), 0),
            lowStock: this.products().filter(p => (p.stock ?? 0) <= 5).length,
            pendingOrders: this.orders().filter(o => o.orderStatus === 'pending').length
          });
          resolve();
        }
      });
    });
  }

  private loadUsers(): Promise<void> {
    return new Promise((resolve) => {
      this.adminService.getUsers().subscribe({
        next: (list) => { this.users.set(list); resolve(); },
        error: () => { this.users.set([]); resolve(); }
      });
    });
  }

  private loadProducts(): Promise<void> {
    return new Promise((resolve) => {
      this.productService.getProducts({}).subscribe({
        next: (list) => { this.products.set(list); resolve(); },
        error: () => { this.products.set([]); resolve(); }
      });
    });
  }

  private loadOrders(): Promise<void> {
    return new Promise((resolve) => {
      this.adminService.getAllOrders().subscribe({
        next: (list) => {
          const mappedOrders = list.map(order => ({
            ...order,
            paymentStatus: StatusMapper.mapPaymentStatus(order.paymentStatus),
            orderStatus: StatusMapper.mapOrderStatus(order.orderStatus)
          }));
          this.orders.set(mappedOrders);
          resolve();
        },
        error: () => { this.orders.set([]); resolve(); }
      });
    });
  }

  // ===== User actions =====
  updateUserRole(userId: string, role: string): void {
    this.adminService.updateUserRole(userId, { role: role as any }).subscribe({
      next: () => {
        this.showToast(this.isAmharic ? 'የተጠቃሚ  ሚና ተቀይሯል' : 'User role updated');
        this.loadUsers();
        this.loadStats();
      },
      error: (e) => {
        console.error(e);
        this.showToast(this.isAmharic ? 'ይቅርታ አልተሳካም' : 'Failed to update user');
      }
    });
  }

  toggleUserBan(userId: string, banned: boolean): void {
    this.adminService.toggleBan(userId, { banned }).subscribe({
      next: () => {
        this.showToast(banned
          ? (this.isAmharic ? 'ተጠቃሚው ተሰርዟል' : 'User banned')
          : (this.isAmharic ? 'ተጠቃሚው ተከፈቱ' : 'User unbanned'));
        this.loadUsers();
        this.loadStats();
      },
      error: () => this.showToast(this.isAmharic ? 'ይቅርታ አልተሳካም' : 'Failed')
    });
  }

  // ===== Product actions =====
  openEditProduct(product: any): void {
    this.editProduct = { ...product };
    this.isEditProductOpen = true;
  }
  closeEditProduct(): void {
    this.editProduct = null;
    this.isEditProductOpen = false;
  }

  openReviewOrder(order: any): void {
  this.reviewOrder = order;
  this.isReviewOrderOpen = true;
}

closeReviewOrder(): void {
  this.reviewOrder = null;
  this.isReviewOrderOpen = false;
}

approvePayment(): void {
  if (!this.reviewOrder?._id) return;
  this.orderService.verifyPayment(this.reviewOrder._id, 'verified').subscribe({
    next: () => {
      this.showToast(this.isAmharic ? 'ክፍያው ጸውቋል' : 'Payment verified');
      this.closeReviewOrder();
      this.loadOrders();
      this.loadStats();
    },
    error: (e) => {
      this.showToast(e.error?.message || 'Failed to verify payment');
    }
  });
}

rejectPayment(): void {
  if (!this.reviewOrder?._id) return;
  this.orderService.verifyPayment(this.reviewOrder._id, 'rejected').subscribe({
    next: () => {
      this.showToast(this.isAmharic ? 'ክፍያው ተቀባይነት አላገኘም' : 'Payment rejected');
      this.closeReviewOrder();
      this.loadOrders();
      this.loadStats();
    },
    error: (e) => {
      this.showToast(e.error?.message || 'Failed to reject payment');
    }
  });
}

  saveProduct(): void {
    if (!this.editProduct) return;
    const id = this.editProduct._id;
    const payload = {
      name: this.editProduct.name,
      price: Number(this.editProduct.price),
      category: this.editProduct.category,
      stock: Number(this.editProduct.stock ?? 0),
      description: this.editProduct.description,
      imageUrl: this.editProduct.imageUrl,
      telegramHandle: this.editProduct.telegramHandle
    };
    this.productService.updateProduct(id, payload).subscribe({
      next: () => {
        this.showToast(this.isAmharic ? 'ምርቱ ተሻሽሏል' : 'Product updated');
        this.closeEditProduct();
        this.loadProducts();
        this.loadStats();
      },
      error: (e) => {
        console.error(e);
        this.showToast(this.isAmharic ? 'ይቅርታ አልተሳካም' : 'Failed to update product');
      }
    });
  }

  toggleProductFeatured(id: string, featured: boolean): void {
    this.productService.updateProduct(id, { featured }).subscribe({
      next: () => {
        this.showToast(featured
          ? (this.isAmharic ? 'የተለመደ ሆኗል' : 'Marked featured')
          : (this.isAmharic ? 'ከተለመዱ ወጣ' : 'Unmarked featured'));
        this.loadProducts();
      },
      error: () => this.showToast(this.isAmharic ? 'ይቅርታ አልተሳካም' : 'Failed')
    });
  }

  deleteProduct(id: string): void {
    const ok = confirm(this.isAmharic ? 'ይህን እቃ ማጥፋት ይፈልጋሉ?' : 'Delete this product?');
    if (!ok) return;
    this.productService.deleteProduct(id).subscribe({
      next: () => {
        this.showToast(this.isAmharic ? 'እቃው ተሰርዟል' : 'Product deleted');
        this.loadProducts();
        this.loadStats();
      },
      error: () => this.showToast(this.isAmharic ? 'ይቅርታ አልተሳካም' : 'Failed to delete')
    });
  }

  // ===== Order actions =====
  updateOrderStatus(orderId: string, updates: any): void {
    this.orderService.updateOrderStatus(orderId, updates).subscribe({
      next: (res: any) => {
        const updatedOrder = res.order || res;
        this.orders.update(orders => orders.map(o => o._id === orderId ? {
          ...o,
          ...updatedOrder,
          paymentStatus: StatusMapper.mapPaymentStatus(updatedOrder.paymentStatus),
          orderStatus: StatusMapper.mapOrderStatus(updatedOrder.orderStatus)
        } : o));
        this.showToast(this.isAmharic ? 'የትእዛዝ ሁኔታ ተሻሽሏል' : 'Order status updated');
        this.loadStats();
      },
      error: () => this.showToast(this.isAmharic ? 'ይቅርታ አልተሳካም' : 'Failed')
    });
  }

  formatCurrency(n: number): string {
    const num = Number(n || 0);
    return `ብር ${num.toLocaleString('en-US')}`;
  }

  statusColor(status: string): string {
    const normalized = StatusMapper.normalizeOrderStatus(status);
    switch (normalized) {
      case 'pending': return 'status-pending';
      case 'confirmed': return 'status-confirmed';
      case 'shipping': return 'status-shipping';
      case 'delivered': return 'status-delivered';
      case 'cancelled': return 'status-cancelled';
      default: return 'status-pending';
    }
  }

  paymentStatusColor(status: string): string {
    const normalized = StatusMapper.normalizePaymentStatus(status);
    switch (normalized) {
      case 'verified': return 'status-delivered';
      case 'receipt_submitted': return 'status-shipping';
      case 'rejected': return 'status-cancelled';
      case 'awaiting_payment': return 'status-pending';
      default: return 'status-pending';
    }
  }
}
