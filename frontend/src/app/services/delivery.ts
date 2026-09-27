import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth';

@Injectable({
  providedIn: 'root'
})
export class DeliveryService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = 'https://telegebeya-e-commerce.onrender.com/api/orders'; 

  searchProducts(query: string, category: string): Observable<any> {
   return this.http.get(`https://telegebeya-e-commerce.onrender.com/api/products?search=${query}&category=${category}`);
  }

  saveAddress(addressData: any): Observable<any> {
    // Dynamically retrieve token from AuthService/localStorage
    const token = this.authService.getToken();

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.post(this.apiUrl, addressData, { headers });
  }
}