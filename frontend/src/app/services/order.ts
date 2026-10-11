import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth';
import { CURRENT_API_URLS } from '../constants/api.constants';
import { StatusMapper } from '../utils/status-mapper';

export interface OrderItem {
  product: string;
  name: string;
  imageUrl?: string;
  quantity: number;
  price: number;
}

export interface Order {
  _id?: string;
  orderNumber?: string;
  customerName?: string;
  phone: string;
  subcity: string;
  streetAddress?: string;
  houseNumber?: string;
  shippingAddress?: string;
  notes?: string;
  items: OrderItem[];
  totalAmount: number;
  paymentMethod: 'telebirr' | 'cash_on_delivery' | 'cbe_birr';
  paymentStatus: 'awaiting_payment' | 'receipt_submitted' | 'verified' | 'rejected' | 'pending' | 'paid' | 'failed';
  orderStatus: 'pending' | 'confirmed' | 'shipping' | 'delivered' | 'cancelled';
  telebirrTransactionId?: string;
  createdAt?: string;
  receiptImage?: string;
  transactionId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = CURRENT_API_URLS.ORDERS;
  private paymentUrl = CURRENT_API_URLS.PAYMENT;

  createOrder(orderData: any): Observable<Order> {
    const token = this.authService.getToken();
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return this.http.post<Order>(this.apiUrl, orderData, { headers });
  }

  getMyOrders(): Observable<Order[]> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.get<Order[]>(`${this.apiUrl}/myorders`, { headers });
  }

  getSellerOrders(): Observable<Order[]> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.get<Order[]>(`${this.apiUrl}/seller/myorders`, { headers });
  }

  getOrderById(id: string): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/${id}`);
  }

  updateOrderStatus(id: string, data: { orderStatus?: string; paymentStatus?: string }): Observable<Order> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.put<Order>(`${this.apiUrl}/${id}/status`, data, { headers });
  }

  initiateTelebirrPayment(orderId: string, amount: number): Observable<any> {
    const token = this.authService.getToken();
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return this.http.post(`${this.paymentUrl}/checkout`, { orderId, amount }, { headers });
  }

  verifyPayment(orderId: string, status: 'verified' | 'rejected', notes?: string): Observable<any> {
    const token = this.authService.getToken();
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return this.http.post(`${this.paymentUrl}/verify-payment`, { orderId, status, notes }, { headers });
  }
}
