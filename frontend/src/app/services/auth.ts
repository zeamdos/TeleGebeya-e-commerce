import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { CURRENT_API_URLS } from '../constants/api.constants';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = CURRENT_API_URLS.AUTH;
  private platformId = inject(PLATFORM_ID);

  // Reactive state holding the currently logged in user (or null)
  currentUser = signal<any>(this.getUserFromStorage());

  constructor(private http: HttpClient) {}

  signup(userData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, userData).pipe(
      tap((res: any) => this.saveSession(res))
    );
  }

  register(userData: any): Observable<any> {
    return this.signup(userData);
  }

  login(credentials: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, credentials).pipe(
      tap((res: any) => this.saveSession(res))
    );
  }

  logout() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('tb_token');
      localStorage.removeItem('tb_user');
    }
    this.currentUser.set(null);
  }

 

  getToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('tb_token');
    }
    return null;
  }

  private saveSession(res: any) {
    if (res.token && res.user) {
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem('tb_token', res.token);
        localStorage.setItem('tb_user', JSON.stringify(res.user));
      }
      this.currentUser.set(res.user);
    }
  }

  private getUserFromStorage(): any {
    // Only attempt to read localStorage if executing inside the browser context
    if (isPlatformBrowser(this.platformId)) {
      const savedUser = localStorage.getItem('tb_user');
      return savedUser ? JSON.parse(savedUser) : null;
    }
    return null;
  }
}