import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth';
import { CartService } from './cart';
import { ProductService, Product } from './services/product';
import { OrderService } from './services/order';
import { TranslationService } from './services/translation';
import { ConfigService } from './services/config';
import { AccountPage } from './pages/account/account';
import { AdminPage } from './pages/admin/admin';
import { HttpClient } from '@angular/common/http'
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, AccountPage, AdminPage],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {

  authService = inject(AuthService);
  cartService = inject(CartService);
  productService = inject(ProductService);
  orderService = inject(OrderService);
  i18n = inject(TranslationService);
  configService = inject(ConfigService);
selectedBase64Image: string = '';
  title = signal('TeleGebeya');

  currentPage: 'home' | 'account' | 'admin' = 'home';
  isCartOpen = false;
  isDeliveryModalOpen = false;
  isSigninModalOpen = false;
  isCheckoutModalOpen = false;
  isOrderSuccessModalOpen = false;
  isProductDetailModalOpen = false;
  isQuickPostModalOpen = false;
  isSubmittingSellerPost = false;
  isWaitlistModalOpen = false;
  isSubmittingWaitlist = false;
  waitlistedProductMap: { [key: string]: boolean } = {};
  waitlistForm = {
    productId: '',
    productName: '',
    selectedColor: '',
    phone: '',
    name: ''
  };

  receiptBase64: string = '';
  Math = Math;
  carouselCurrentIndex = 0;
  private carouselTimer: any = null;
  selectedFile: File | null = null;
  imagePreview: string | null = null;

constructor(private http: HttpClient) {}


onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;

      // Local preview before upload
      const reader = new FileReader();
      reader.onload = () => (
        this.selectedBase64Image = reader.result as string,
        this.imagePreview = reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  onReceiptSelected(event: any) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      this.receiptBase64 = reader.result as string;
    };
    reader.readAsDataURL(file);
  }
}
  
  placeOrder() {
    const orderPayload = {
      user: this.getUser()?.id || this.getUser()?._id || undefined,
      customerName: this.checkoutForm.fullName,
      phone: this.checkoutForm.phone,
      subcity: this.checkoutForm.subcity,
      streetAddress: this.checkoutForm.streetAddress,
      houseNumber: this.checkoutForm.houseNumber,
      shippingAddress: `${this.checkoutForm.subcity}, ${this.checkoutForm.streetAddress || 'Addis Ababa'} House #${this.checkoutForm.houseNumber || 'N/A'}`,
      notes: this.checkoutForm.notes,
      paymentMethod: this.checkoutForm.paymentMethod,
      paymentPhone: this.checkoutForm.telebirrPhone,
      receiptImage: this.receiptBase64,
      paymentStatus: this.checkoutForm.paymentMethod === 'cash_on_delivery' ? 'pending' : 'pending',
      items: this.cartService.items().map(item => ({
        product: item._id,
        name: item.name,
        imageUrl: item.imageUrl,
        quantity: item.quantity,
        price: item.price,
        selectedColor: item.selectedColor || ''
      })),
      totalAmount: this.cartService.totalAmount()
    };

    this.orderService.createOrder(orderPayload).subscribe({
      next: (order) => {
        this.confirmedOrder = order;
        this.cartService.clearCart();
        this.closeCheckoutModal();
        this.isOrderSuccessModalOpen = true;
        this.receiptBase64 = '';
        this.showToast(this.isAmharic ? 'ትእዛዝዎ ተልኳል' : 'Order placed successfully');
      },
      error: (err: any) => {
        console.error('Order submission failed', err);
        const errMsg = err.error?.message || err.message || 'Order could not be placed. Please try again.';
        alert(errMsg);
      }
    });
  }

  heroCarouselSlides = [
    {
      imageUrl: '/coffee-ceremony.png',
      title: { en: 'Traditional Coffee Ceremony', am: 'የቡና ስነ-ስርዓት' },
      subtitle: { en: 'Authentic Ethiopian bunna experience delivered to your door', am: 'ከቡና ስነ-ስርዓት ጋር የተያያዙ እቃዎች' }
    },
    {
      imageUrl: '/fashion.jpg',
      title: { en: 'Habesha Fashion & Apparel', am: 'የሀበሻ ልብሶች' },
      subtitle: { en: 'Hand-woven traditional clothing from local artisans', am: 'ከአዲስ አበባ ተለማሾች የተዘጋጁ ባህላዊ ልብሶች' }
    },
    {
      imageUrl: '/merkato.jpg',
      title: { en: 'Shop Local Market', am: 'የመርካቶ ገበያ' },
      subtitle: { en: 'Everything from Merkato, conveniently delivered via Telegram', am: 'ከመርካቶ የሚገኙ ሁሉም እቃዎች በቴሌግራም በቀጥታ' }
    },
    {
      imageUrl: '/e-commerce.jpg',
      title: { en: 'Telegram E-Commerce', am: 'የቴሌግራም ገበያ' },
      subtitle: { en: 'Order & pay via Telebirr — simple Telegram commerce in Ethiopia', am: 'በቴሌብር ይክፈሉ፣ በቴሌግራም ይዘዙ፣ በቀጥታ ይደርስዎታል' }
    }
  ];

  products = signal<Product[]>([]);
  isLoadingProducts = signal<boolean>(false);
  selectedCategory = 'All';
  searchQuery = '';
  sortBy = 'newest';

  selectedProduct: Product | null = null;
  detailQuantity = 1;
  selectedColor = '';

  toastMessage = signal<string>('');

  confirmedOrder: any = null;

  selectedDeliveryLocation = 'Addis Ababa, ET';
  deliveryDetails = {
    phone: '',
    subcity: 'Bole',
    streetAddress: '',
    houseNumber: '',
    notes: ''
  };

  sellerPost: {
    name: string;
    price: number | null;
    category: string;
    telegramHandle: string;
    imageUrl: string;
    description: string;
    colors: { name: string; stock: number }[];
    telebirrPhone: string;
    cbeAccount: string;
  } = {
    name: '',
    price: null,
    category: 'Apparel',
    telegramHandle: '',
    imageUrl: '',
    description: '',
    colors: [{ name: 'Default', stock: 25 }],
    telebirrPhone: '',
    cbeAccount: ''
  };

  checkoutForm = {
    fullName: '',
    phone: '',
    subcity: 'Bole',
    streetAddress: '',
    houseNumber: '',
    notes: '',
    paymentMethod: 'telebirr' as 'telebirr' | 'cash_on_delivery' | 'cbe_birr',
    telebirrPhone: ''
  };
  isSubmittingOrder = false;

  authMode: 'signin' | 'signup' = 'signin';
  selectedRole: 'buyer' | 'seller' = 'buyer';
  signinData = { phone: '', password: '' };
  signupData = { fullName: '', phone: '', password: '', shopName: '', telegramHandle: '' };
  authErrorMessage = '';

  categories = [
    { value: 'All', en: 'All', am: 'ሁሉም' },
    { value: 'Apparel', en: 'Apparel & Shoes', am: 'ልብሶች እና ጫማዎች' },
    { value: 'Leather', en: 'Leather & Bags', am: 'የቆዳ ውጤቶች' },
    { value: 'Home', en: 'Coffee & Home', am: 'የቤትና ቡና እቃዎች' },
    { value: 'Tech', en: 'Tech & Gadgets', am: 'ቴክኖሎጂ' },
    { value: 'Beauty', en: 'Beauty & Care', am: 'የውበት መጠበቂያ' }
  ];

  subcities = [
    'Bole', 'Kirkos', 'Arada', 'Yeka', 'Nifas Silk', 
    'Lideta', 'Addis Ketema', 'Gullele', 'Akaky Kaliti', 
    'Kolfe Keranio', 'Lemi Kura'
  ];


  get isAmharic(): boolean {
    return this.i18n.isAmharic();
  }

  get isAdmin(): boolean {
    return this.authService.currentUser()?.role === 'admin';
  }

  get isSeller(): boolean {
    const role = this.authService.currentUser()?.role;
    return role === 'seller' || role === 'admin';
  }

  get botUsername(): string {
    return this.configService.botUsername;
  }

  get botLink(): string {
    return this.configService.botDeepLink;
  }

  currentSlide = computed(() => this.heroCarouselSlides[this.carouselCurrentIndex]);

  async ngOnInit() {
    await this.configService.loadConfig();
    this.loadProducts();
    this.startCarousel();
  }

  startCarousel() {
    this.stopCarousel();
    this.carouselTimer = setInterval(() => {
      this.nextSlide();
    }, 5000);
  }

  stopCarousel() {
    if (this.carouselTimer) {
      clearInterval(this.carouselTimer);
      this.carouselTimer = null;
    }
  }

  goToSlide(index: number) {
    this.carouselCurrentIndex = (index + this.heroCarouselSlides.length) % this.heroCarouselSlides.length;
    this.startCarousel();
  }

  nextSlide() {
    this.carouselCurrentIndex = (this.carouselCurrentIndex + 1) % this.heroCarouselSlides.length;
  }

  prevSlide() {
    this.carouselCurrentIndex = (this.carouselCurrentIndex - 1 + this.heroCarouselSlides.length) % this.heroCarouselSlides.length;
    this.startCarousel();
  }

  loadProducts() {
    this.isLoadingProducts.set(true);
    this.productService.getProducts({
      category: this.selectedCategory,
      search: this.searchQuery,
      sort: this.sortBy === 'price-asc' ? 'price-asc' : (this.sortBy === 'price-desc' ? 'price-desc' : undefined)
    }).subscribe({
      next: (data) => {
        this.products.set(data);
        this.isLoadingProducts.set(false);
      },
      error: (err) => {
        console.error('Failed to load products', err);
        this.isLoadingProducts.set(false);
      }
    });
  }

  filterCategory(categoryValue: string) {
    this.selectedCategory = categoryValue;
    this.loadProducts();
  }

  onSearch() {
    this.currentPage = 'home';
    this.loadProducts();
  }

  onSortChange() {
    this.loadProducts();
  }

  getUser() {
    return this.authService.currentUser();
  }

  toggleLanguage() {
    this.i18n.toggleLanguage();
  }

  handleAccountClick() {
    const user = this.getUser();
    if (user) {
      this.currentPage = 'account';
    } else {
      this.openSigninModal();
    }
  }

  handleAdminClick() {
    const user = this.getUser();
    if (user?.role === 'admin') {
      this.currentPage = 'admin';
    } else {
      this.showToast(this.isAmharic ? 'ለአድሚን ብቻ ነው' : 'Admin access only');
    }
  }

  goHome() {
    this.currentPage = 'home';
    this.loadProducts();
  }

  toggleCart() {
    this.isCartOpen = !this.isCartOpen;
  }

  openDeliveryModal() {
    this.isDeliveryModalOpen = true;
  }

  closeDeliveryModal() {
    this.isDeliveryModalOpen = false;
  }

  saveDeliveryLocation() {
    this.selectedDeliveryLocation = `${this.deliveryDetails.subcity}, Addis Ababa`;
    this.closeDeliveryModal();
    this.showToast(this.isAmharic ? 'የማድረሻ ቦታ ተቀይሯል' : 'Delivery location updated');
  }

  openSigninModal(mode: 'signin' | 'signup' = 'signin') {
    this.authMode = mode;
    this.authErrorMessage = '';
    this.isSigninModalOpen = true;
  }

  closeSigninModal() {
    this.isSigninModalOpen = false;
    this.authErrorMessage = '';
  }

  getProductColorOptions(product: Product | null): { name: string; stock: number }[] {
    if (!product) return [];
    if (Array.isArray(product.colors) && product.colors.length > 0) {
      return product.colors
        .filter(color => !!color?.name)
        .map(color => ({ name: color.name.trim(), stock: Number(color.stock ?? 0) }));
    }
    if (product.color) {
      return [{ name: product.color.trim(), stock: Number(product.stock ?? 0) }];
    }
    return [];
  }

  getProductColorStock(product: Product | null, colorName?: string): number {
    const options = this.getProductColorOptions(product);
    if (!options.length) return Number(product?.stock ?? 0);
    const target = (colorName || this.selectedColor || options[0].name || '').trim();
    const match = options.find(option => option.name.toLowerCase() === target.toLowerCase());
    return match ? Number(match.stock ?? 0) : Number(options[0].stock ?? product?.stock ?? 0);
  }

  getAvailableProductStock(product: Product | null, colorName?: string): number {
    const options = this.getProductColorOptions(product);
    if (options.length > 0) {
      if (colorName) return this.getProductColorStock(product, colorName);
      return options.reduce((sum, option) => sum + Math.max(0, Number(option.stock ?? 0)), 0);
    }
    return Number(product?.stock ?? 0);
  }

  normalizeProductColors(colors: Array<{ name?: string; stock?: number } | null | undefined> | undefined): { name: string; stock: number }[] {
    const normalized = (colors || [])
      .filter((color): color is { name: string; stock: number } => !!color && !!color.name && color.name.trim().length > 0)
      .map(color => ({
        name: color.name.trim(),
        stock: Math.max(0, Number(color.stock ?? 0))
      }))
      .filter(color => color.name.length > 0);

    return normalized.length > 0 ? normalized : [{ name: 'Default', stock: 25 }];
  }

  addSellerColor() {
    const current = this.sellerPost.colors || [];
    this.sellerPost = {
      ...this.sellerPost,
      colors: [...current, { name: '', stock: 0 }]
    };
  }

  removeSellerColor(index: number) {
    this.sellerPost = {
      ...this.sellerPost,
      colors: (this.sellerPost.colors || []).filter((_, idx) => idx !== index)
    };
  }

  trackByColorIndex(index: number) {
    return index;
  }

  openProductDetail(product: Product) {
    this.selectedProduct = product;
    this.selectedColor = this.getProductColorOptions(product)[0]?.name || '';
    this.detailQuantity = 1;
    this.isProductDetailModalOpen = true;
  }

  closeProductDetail() {
    this.isProductDetailModalOpen = false;
    this.selectedProduct = null;
  }

  openQuickPostModal() {
    const user = this.getUser();
    this.sellerPost = {
      name: '',
      price: null,
      category: 'Apparel',
      telegramHandle: user?.telegramHandle || '@myshop',
      imageUrl: '',
      description: '',
      colors: [{ name: 'Default', stock: 25 }],
      telebirrPhone: '',
      cbeAccount: ''
    };
    this.isQuickPostModalOpen = true;
  }

  closeQuickPostModal() {
    this.isQuickPostModalOpen = false;
  }

submitSellerPost() {

if (this.isSubmittingSellerPost) return;

    if (!this.sellerPost.name || !this.sellerPost.price) {
      alert(this.isAmharic ? 'እባክዎ የዕቃውን ስም እና ዋጋ ያስገቡ' : 'Please provide product name and price');
      return;
    }
    const colors = this.normalizeProductColors(this.sellerPost.colors).map(item => ({
      name: item.name,
      stock: Math.max(0, Number(item.stock ?? 0))
    }));
    const totalStock = colors.reduce((sum, item) => sum + Number(item.stock || 0), 0);
    const payload = {
      name: this.sellerPost.name,
      price: Number(this.sellerPost.price),
      category: this.sellerPost.category,
      stock: totalStock || 25,
      color: colors[0]?.name || '',
      colors,
      description: this.sellerPost.description || this.sellerPost.name,
      imageUrl: this.selectedBase64Image || this.sellerPost.imageUrl || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
      telegramHandle: this.sellerPost.telegramHandle || '@TeleGebeya_Shop_bot',
      sellerName: this.getUser()?.fullName || 'Telegram Merchant',
      sellerTelebirr: this.sellerPost.telebirrPhone || this.getUser()?.phone || '',
      sellerCbeAccount: this.sellerPost.cbeAccount || ''
    };

     this.isSubmittingSellerPost = true;

    this.productService.createProduct(payload).subscribe({
      next: (created) => {
        this.closeQuickPostModal();
        this.products.update(list => [created, ...list]);
        this.showToast(this.isAmharic ? 'ዕቃው በተሳካ ሁኔታ ተለጥፏል' : 'Product listed successfully');
        this.selectedBase64Image = '';
      },
      error: (err) => {
         this.isSubmittingSellerPost = false;
        console.error('Failed to post product', err);
        const msg = err.error?.message || 'Failed to post product. Please try again.';
        this.showToast(msg);
      }
    });
  }

  hasStock(item: any, targetQuantity: number, colorName?: string): boolean {
    if (!item) return false;
    if (item.stock === undefined || item.stock === null) return true;
    const options = this.getProductColorOptions(item);
    if (options.length > 0) {
      const selectedColor = (colorName || item.selectedColor || this.selectedColor || options[0].name || '').trim();
      const requested = options.find(option => option.name.toLowerCase() === selectedColor.toLowerCase());
      const stock = requested ? Number(requested.stock ?? item.stock) : Number(options[0].stock ?? item.stock);
      return targetQuantity <= stock;
    }
    return targetQuantity <= item.stock;
  }

  addToCart(product: Product, quantity: number = 1, event?: Event, selectedColorOverride?: string) {
    if (event) {
      event.stopPropagation();
    }
    const colorName = selectedColorOverride || this.selectedColor || this.getProductColorOptions(product)[0]?.name || '';
    if (!this.hasStock(product, quantity, colorName)) {
      const available = this.getProductColorStock(product, colorName);
      const msg = this.isAmharic
        ? `"${product.name}" የቀረበ ብዛት የለም። ቀሪ ${available} ብቻ ነው።`
        : `Insufficient stock for "${product.name}". Only ${available} available.`;
      this.showToast(msg);
      return;
    }
    this.cartService.addToCart(product, quantity, colorName);
    const msg = this.isAmharic
      ? `"${product.name}"${colorName ? ` (${colorName})` : ''} ወደ ቅርጫት ተጨምሯል`
      : `Added "${product.name}"${colorName ? ` in ${colorName}` : ''} to cart`;
    this.showToast(msg);
  }

  isWaitlisted(product: Product | null, colorName?: string): boolean {
    if (!product || !product._id) return false;
    const key = `${product._id}_${(colorName || this.selectedColor || '').toLowerCase()}`;
    if (this.waitlistedProductMap[key] || this.waitlistedProductMap[product._id]) return true;

    const user = this.getUser();
    if (user && Array.isArray(product.waitlist)) {
      const uId = user.id || user._id;
      const uPhone = user.phone;
      return product.waitlist.some(w =>
        (uId && String(w.user || '') === String(uId)) ||
        (uPhone && String(w.phone || '').replace(/\D/g, '').slice(-9) === String(uPhone).replace(/\D/g, '').slice(-9))
      );
    }
    return false;
  }

  openWaitlistModal(product: Product, colorName?: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    const color = colorName || this.selectedColor || this.getProductColorOptions(product)[0]?.name || '';
    const user = this.getUser();

    this.waitlistForm = {
      productId: product._id,
      productName: product.name,
      selectedColor: color,
      phone: user?.phone || '',
      name: user?.fullName || ''
    };

    if (user && user.phone) {
      this.submitWaitlist();
    } else {
      this.isWaitlistModalOpen = true;
    }
  }

  closeWaitlistModal() {
    this.isWaitlistModalOpen = false;
  }

  submitWaitlist() {
    if (!this.waitlistForm.productId) return;
    if (!this.waitlistForm.phone && !this.getUser()) {
      alert(this.isAmharic ? 'እባክዎ ስልክ ቁጥር ያስገቡ' : 'Please provide a phone number so we can notify you.');
      return;
    }

    this.isSubmittingWaitlist = true;
    const pid = this.waitlistForm.productId;
    const color = this.waitlistForm.selectedColor;

    this.productService.joinWaitlist(pid, {
      phone: this.waitlistForm.phone,
      name: this.waitlistForm.name,
      selectedColor: color
    }).subscribe({
      next: (res) => {
        this.isSubmittingWaitlist = false;
        this.waitlistedProductMap[pid] = true;
        const key = `${pid}_${color.toLowerCase()}`;
        this.waitlistedProductMap[key] = true;
        this.closeWaitlistModal();
        const msg = this.isAmharic
          ? 'በተጠባባቂ ዝርዝር ውስጥ ተመዝግበዋል! እቃው ሲገባ ይገለጽልዎታል'
          : "You've been added to the waitlist! We'll notify you when it's back in stock.";
        this.showToast(msg);
      },
      error: (err) => {
        this.isSubmittingWaitlist = false;
        console.error('Waitlist submission failed:', err);
        const errMsg = err.error?.message || 'Failed to join waitlist. Please try again.';
        this.showToast(errMsg);
      }
    });
  }

  quickBuy(product: Product, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    const preferredColor = this.getProductColorOptions(product)[0]?.name || '';
    if (!this.hasStock(product, 1, preferredColor)) {
      this.openWaitlistModal(product, preferredColor, event);
      return;
    }
    this.addToCart(product, 1, undefined, preferredColor);
    this.isCartOpen = false;
    this.isProductDetailModalOpen = false;
    this.openCheckoutModal();
  }

  openCheckoutModal() {
     this.checkoutForm.subcity = this.deliveryDetails.subcity;
  this.checkoutForm.streetAddress = this.deliveryDetails.streetAddress;
  this.checkoutForm.houseNumber = this.deliveryDetails.houseNumber;
    if (this.cartService.items().length === 0) {
      alert(this.isAmharic ? 'ቅርጫትዎ ባዶ ነው' : 'Your cart is empty.');
      return;
    }

    const user = this.getUser();
    if (user) {
      this.checkoutForm.fullName = user.fullName || '';
      this.checkoutForm.phone = user.phone || '';
      this.checkoutForm.telebirrPhone = user.phone || '';
    }

    this.isCartOpen = false;
    this.isCheckoutModalOpen = true;
  }

  closeCheckoutModal() {
    this.isCheckoutModalOpen = false;
  }

 submitOrder() {
    if (!this.checkoutForm.fullName || !this.checkoutForm.phone) {
      alert(this.isAmharic ? 'እባክዎ ሙሉ ስም እና ስልክ ቁጥር ያስገቡ' : 'Please provide full name and phone number');
      return;
    }

  if (!this.checkoutForm.streetAddress?.trim() || !this.checkoutForm.houseNumber?.trim()) {
    this.closeCheckoutModal();
    this.openDeliveryModal();
    this.showToast(this.isAmharic ? 'እባክዎ የማድረሻ አድራሻዎን ይሙሉ' : 'Please fill in your delivery address first');
    return;
  }

    this.isSubmittingOrder = true;
    const user = this.getUser();
    const orderPayload = {
      user: user?.id || user?._id || undefined,
      customerName: this.checkoutForm.fullName,
      phone: this.checkoutForm.phone,
      subcity: this.checkoutForm.subcity,
      streetAddress: this.checkoutForm.streetAddress,
      houseNumber: this.checkoutForm.houseNumber,
      shippingAddress: `${this.checkoutForm.subcity}, ${this.checkoutForm.streetAddress || 'Addis Ababa'} House #${this.checkoutForm.houseNumber || 'N/A'}`,
      notes: this.checkoutForm.notes,
      paymentMethod: this.checkoutForm.paymentMethod,
      paymentPhone: this.checkoutForm.telebirrPhone,
      receiptImage: this.receiptBase64,
      paymentStatus: this.checkoutForm.paymentMethod === 'cash_on_delivery' ? 'pending' : 'pending',
      items: this.cartService.items().map(item => ({
        product: item._id,
        name: item.name,
        imageUrl: item.imageUrl,
        quantity: item.quantity,
        price: item.price,
        selectedColor: item.selectedColor || ''
      })),
      totalAmount: this.cartService.totalAmount()
    };

    this.orderService.createOrder(orderPayload).subscribe({
      next: (order) => {
        this.isSubmittingOrder = false;
        this.confirmedOrder = order;
        this.cartService.clearCart();
        this.closeCheckoutModal();
        this.isOrderSuccessModalOpen = true;
        this.receiptBase64 = '';
        this.loadProducts();
      },
      error: (err: any) => {
        this.isSubmittingOrder = false;
        console.error('Order placement failed', err);
        const errMsg = err.error?.message || err.message;
        if (errMsg) {
          alert(errMsg);
        }
      }
    });
  }

  closeOrderSuccessModal() {
    this.isOrderSuccessModalOpen = false;
    this.confirmedOrder = null;
  }

  openTelegramSeller(handle?: string, event?: Event) {
    if (event) event.stopPropagation();
    window.open(this.configService.getSellerLink(handle), '_blank');
  }

  getTelegramTrackUrl(): string {
    const orderId = this.confirmedOrder?.orderNumber || this.confirmedOrder?._id || 'TG-ORDER';
    return this.configService.getTrackLink(orderId);
  }

  submitSignin() {
    this.authErrorMessage = '';
    this.authService.login(this.signinData).subscribe({
      next: () => {
        this.closeSigninModal();
        this.showToast(this.isAmharic ? 'እንኳን በደህና መጡ' : 'Signed in successfully');
      },
      error: (err: any) => {
        this.authErrorMessage = err.error?.message || 'Invalid phone or password';
      }
    });
  }

  submitSignup() {
    this.authErrorMessage = '';
    const payload = {
      ...this.signupData,
      role: this.selectedRole
    };
    this.authService.signup(payload).subscribe({
      next: () => {
        this.closeSigninModal();
        this.showToast(this.isAmharic ? 'መለያ ተፈጥሯል' : 'Account created');
      },
      error: (err: any) => {
        this.authErrorMessage = err.error?.message || 'Registration failed';
      }
    });
  }


  showToast(msg: string) {
    this.toastMessage.set(msg);
    setTimeout(() => {
      this.toastMessage.set('');
    }, 2800);
  }
}

