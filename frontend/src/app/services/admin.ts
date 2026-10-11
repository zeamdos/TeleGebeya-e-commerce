import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth';
import { CURRENT_API_URLS } from '../constants/api.constants';

export interface AdminStats {
  users?: number;
  sellers?: number;
  products?: number;
  orders?: number;
  revenue?: number;
  lowStock?: number;
  pendingOrders?: number;
  totalUsers?: number;
  totalSellers?: number;
  totalProducts?: number;
  totalOrders?: number;
  totalRevenue?: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = CURRENT_API_URLS.ADMIN;

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.apiUrl}/stats`, { headers: this.getHeaders() });
  }

  getDashboardStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/stats`, { headers: this.getHeaders() });
  }

  getUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/users`, { headers: this.getHeaders() });
  }

  getAllUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/users`, { headers: this.getHeaders() });
  }

  updateUserRole(userId: string, data: { role?: string; banned?: boolean; shopName?: string; telegramHandle?: string }): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/users/${userId}/role`, data, { headers: this.getHeaders() });
  }

  toggleBan(userId: string, data: { banned: boolean }): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/users/${userId}/role`, data, { headers: this.getHeaders() });
  }

  deleteUser(userId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/users/${userId}`, { headers: this.getHeaders() });
  }

  adminUpdateProduct(productId: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/products/${productId}`, data, { headers: this.getHeaders() });
  }

  adminDeleteProduct(productId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/products/${productId}`, { headers: this.getHeaders() });
  }

  getAllOrders(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/orders`, { headers: this.getHeaders() });
  }

  getProducts(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/products`, { headers: this.getHeaders() });
  }

  updateProduct(productId: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/products/${productId}`, data, { headers: this.getHeaders() });
  }

  deleteProduct(productId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/products/${productId}`, { headers: this.getHeaders() });
  }
}
