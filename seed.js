const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');
const connectDB = require('./config/db');

const seedProducts = [
  {
    name: 'Pro Wireless Bluetooth Earbuds',
    description: 'High quality noise-cancelling wireless earbuds with deep bass and 30-hour battery life.',
    price: 2450,
    stock: 45,
    category: 'Tech',
    imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80',
    sellerName: 'Bole Gadgets & Tech',
    sellerPhone: '0911445566',
    telegramHandle: '@bolegadgets',
    rating: 4.9,
    reviewsCount: 38,
    featured: true
  },
  {
    name: 'Handmade Ethiopian Genuine Leather Bag',
    description: '100% authentic Ethiopian cow leather messenger bag crafted in Addis Ababa. Durable and classic style.',
    price: 3800,
    stock: 20,
    category: 'Leather',
    imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&auto=format&fit=crop&q=80',
    sellerName: 'Marta Addis Leather',
    sellerPhone: '0922334455',
    telegramHandle: '@martaleather',
    rating: 4.8,
    reviewsCount: 24,
    featured: true
  },
  {
    name: 'Traditional Ethiopian Coffee Ceremony Set (Jebena & Sini)',
    description: 'Authentic clay Jebena with 6 decorated ceramic Sini cups and wooden Rekebot stand for traditional bunna.',
    price: 2950,
    stock: 35,
    category: 'Home',
    imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80',
    sellerName: 'Merkato Heritage Crafts',
    sellerPhone: '0933112233',
    telegramHandle: '@merkatocrafts',
    rating: 5.0,
    reviewsCount: 52,
    featured: true
  },
  {
    name: 'Modern Smart Watch Ultra 2 with Health Tracker',
    description: 'Full touch AMOLED display, heart rate monitor, sleep tracking, call notifications, and waterproof casing.',
    price: 4200,
    stock: 25,
    category: 'Tech',
    imageUrl: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=600&auto=format&fit=crop&q=80',
    sellerName: 'Piassa Electronics Hub',
    sellerPhone: '0912987654',
    telegramHandle: '@piassaelectronics',
    rating: 4.7,
    reviewsCount: 19,
    featured: true
  },
  {
    name: 'Premium Cotton Ethiopian Shema Scarf (Netela)',
    description: 'Hand-woven fine white cotton Netela with colorful Tilet border embroidery. Perfect for holidays and church.',
    price: 1850,
    stock: 60,
    category: 'Apparel',
    imageUrl: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=600&auto=format&fit=crop&q=80',
    sellerName: 'Shiro Meda Weavers',
    sellerPhone: '0911778899',
    telegramHandle: '@shiromedaweavers',
    rating: 4.9,
    reviewsCount: 41,
    featured: false
  },
  {
    name: 'Men Urban Athletic Sneakers',
    description: 'Lightweight, breathable sports and casual running sneakers with cushioned shock-absorbing soles.',
    price: 3500,
    stock: 40,
    category: 'Apparel',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
    sellerName: 'CMC Kicks & Apparel',
    sellerPhone: '0944556677',
    telegramHandle: '@cmckicks',
    rating: 4.6,
    reviewsCount: 15,
    featured: false
  },
  {
    name: 'Pure Ethiopian Honey & Organic Beeswax Lip Balm Set',
    description: 'All-natural skincare kit made from raw Tigray white honey and beeswax with vitamin E moisturizers.',
    price: 850,
    stock: 120,
    category: 'Beauty',
    imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80',
    sellerName: 'Habesha Naturals',
    sellerPhone: '0913221100',
    telegramHandle: '@habeshanaturals',
    rating: 4.9,
    reviewsCount: 63,
    featured: false
  },
  {
    name: 'Ethiopian Sidama & Yirgacheffe Specialty Coffee Beans (1kg)',
    description: 'Grade 1 freshly medium-roasted Arabica whole beans with fruity aroma, floral notes, and smooth finish.',
    price: 1200,
    stock: 90,
    category: 'Home',
    imageUrl: 'https://images.unsplash.com/photo-1587734195503-904fca47e0e9?w=600&auto=format&fit=crop&q=80',
    sellerName: 'Kaffa Roasters Addis',
    sellerPhone: '0911882233',
    telegramHandle: '@kaffaroasters',
    rating: 5.0,
    reviewsCount: 77,
    featured: true
  }
];

const seedDatabase = async () => {
  try {
    await connectDB();
    
    // Clear existing products to prevent duplicates during testing
    await Product.deleteMany({});
    console.log('Cleared existing products...');

    // Insert new dummy products
    await Product.insertMany(seedProducts);
    console.log('Successfully added dummy products to the database!');

    process.exit();
  } catch (error) {
    console.error('Error seeding database:', error.message);
    process.exit(1);
  }
};

seedDatabase();
