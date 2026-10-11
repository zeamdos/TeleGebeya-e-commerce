export const API_URLS = {
  API_BASE: 'https://telegebeya-e-commerce.onrender.com/api',
  ORDERS: 'https://telegebeya-e-commerce.onrender.com/api/orders',
  PAYMENT: 'https://telegebeya-e-commerce.onrender.com/api/payment',
  PRODUCTS: 'https://telegebeya-e-commerce.onrender.com/api/products',
  AUTH: 'https://telegebeya-e-commerce.onrender.com/api/auth',
  ADMIN: 'https://telegebeya-e-commerce.onrender.com/api/admin',
  CONFIG: 'https://telegebeya-e-commerce.onrender.com/api/config'
} as const;

export const LOCAL_API_URLS = {
  API_BASE: 'http://localhost:5000/api',
  ORDERS: 'http://localhost:5000/api/orders',
  PAYMENT: 'http://localhost:5000/api/payment',
  PRODUCTS: 'http://localhost:5000/api/products',
  AUTH: 'http://localhost:5000/api/auth',
  ADMIN: 'http://localhost:5000/api/admin',
  CONFIG: 'http://localhost:5000/api/config'
} as const;

export const USE_LOCAL_API = false;

export const CURRENT_API_URLS = USE_LOCAL_API ? LOCAL_API_URLS : API_URLS;
