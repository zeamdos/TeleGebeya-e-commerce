import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  isAmharic = signal<boolean>(false);

  toggleLanguage() {
    this.isAmharic.update(val => !val);
  }

  t(key: string): string {
    const lang = this.isAmharic() ? 'am' : 'en';
    return (this.dictionary[key] && this.dictionary[key][lang]) || key;
  }

  private dictionary: Record<string, { en: string; am: string }> = {
    freeDeliveryBanner: {
      en: 'Free delivery on orders over 1,000 ETB!',
      am: 'ከ 1,000 ብር በላይ ላዘዙ ነፃ እናደርሳለን!'
    },
    deliverTo: { en: 'Deliver to', am: 'ማድረሻ ቦታ' },
    addisAbaba: { en: 'Addis Ababa, ET', am: 'አዲስ አበባ' },
    searchPlaceholder: {
      en: 'Search on TeleGebeya',
      am: 'በቴሌገበያ ይፈልጉ...'
    },
    allCategories: { en: 'All', am: 'ሁሉም' },
    helloSignIn: { en: 'Hello, Sign in', am: 'ሰላም, ወደ አካውንትህ ግባ' },
    accountLists: { en: 'Account', am: 'አካውንት' },
    returns: { en: 'Returns', am: 'ተመላሾች' },
    orders: { en: '& Orders', am: '& ትዕዛዞች' },
    cart: { en: 'Cart', am: 'ካርት' },
    all: { en: 'All', am: 'ሁሉም' },
    todaysDeals: { en: 'Deals', am: 'ቅናሾች' },
    sellerHub: { en: 'Sell', am: 'መሸጫ' },
    inStock: { en: 'In Stock', am: 'አለ' },
    outOfStock: { en: 'Out of Stock', am: 'አልቋል' },
    birr: { en: 'ETB', am: 'ብር' },
    addToCart: { en: 'Add to Cart', am: 'ወደ ቅርጫት' },
    buyNow: { en: 'Buy Now', am: 'አሁን ይግዙ' },
    telegramChat: { en: 'Telegram', am: 'ቴሌግራም' },
    cartTitle: { en: 'Shopping Cart', am: 'የግዢ ቅርጫት' },
    emptyCartMsg: { en: 'Your cart is empty', am: 'ቅርጫትዎ ባዶ ነው' },
    subtotal: { en: 'Subtotal', am: 'ድምር' },
    deliveryFee: { en: 'Delivery', am: 'ማድረሻ' },
    free: { en: 'Free', am: 'ነፃ' },
    total: { en: 'Total', am: 'አጠቃላይ' },
    proceedCheckout: { en: 'Proceed to Checkout', am: 'ወደ ክፍያ ሂድ' },
    checkoutTitle: { en: 'Checkout', am: 'ክፍያ' },
    shippingAddress: { en: 'Delivery Address', am: 'የማድረሻ አድራሻ' },
    subcity: { en: 'Subcity', am: 'ክፍለ ከተማ' },
    streetAddress: { en: 'Street / Landmark', am: 'መንገድ / መለያ ቦታ' },
    houseNumber: { en: 'House Number', am: 'የቤት ቁጥር' },
    phone: { en: 'Phone Number', am: 'ስልክ ቁጥር' },
    notes: { en: 'Delivery Notes', am: 'ተጨማሪ ማስታወሻ' },
    paymentMethod: { en: 'Payment Method', am: 'የክፍያ ዘዴ' },
    telebirrDesc: { en: 'Pay with Telebirr', am: 'በቴሌብር ይክፈሉ' },
    codDesc: { en: 'Pay on delivery (Cash)', am: 'ሲደርስ በጥሬ ገንዘብ' },
    placeOrder: { en: 'Place Order', am: 'እዘዝ' },
    orderConfirmed: { en: 'Order Placed', am: 'ትዕዛዝ ተመዝግቧል' },
    orderThanks: {
      en: 'Your order has been placed with the seller.',
      am: 'ትዕዛዝዎ ለሻጩ ተልኳል።'
    },
    orderNumber: { en: 'Order Number', am: 'የትዕዛዝ ቁጥር' },
    trackOnTelegram: { en: 'Open in Telegram', am: 'በቴሌግራም ክፈት' },
    continueShopping: { en: 'Continue Shopping', am: 'ግዢ ይቀጥሉ' },
    myProfile: { en: 'Profile', am: 'መለያ' },
    myOrders: { en: 'Orders', am: 'ትዕዛዞች' },
    sellerDashboard: { en: 'Seller', am: 'የሻጭ' },
    addNewProduct: { en: '+ Add Product', am: '+ ዕቃ ለጥፍ' },
    productName: { en: 'Product Title', am: 'የዕቃው ስም' },
    productPrice: { en: 'Price (ETB)', am: 'ዋጋ (ብር)' },
    productCategory: { en: 'Category', am: 'ምድብ' },
    productDescription: { en: 'Description', am: 'መግለጫ' },
    productImageUrl: { en: 'Image URL', am: 'የምስል ሊንክ' },
    productStock: { en: 'Stock', am: 'ብዛት' },
    sellerTelegramHandle: { en: 'Telegram Username (@)', am: 'የቴሌግራም ዩዘርኔም (@)' },
    saveAndPublish: { en: 'Save Product', am: 'መዝግብ' },
    deleteProduct: { en: 'Delete', am: 'ሰርዝ' },
    heroTitle: { en: 'Ethiopian Marketplace', am: 'የኢትዮጵያ ገበያ' },
    heroSubtitle: { en: 'Local products delivered from verified Telegram shops.', am: 'ከቴሌግራም ሱቆች በቀጥታ ወደ እርስዎ።' }
  };
}
