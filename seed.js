const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');
const connectDB = require('./config/db');

const seedProducts = [
  {
    name: 'Wireless Headphones',
    description: 'High quality noise-cancelling wireless headphones.',
    price: 2500,
    stock: 50,
    category: 'Electronics',
    imageUrl: 'https://via.placeholder.com/300?text=Headphones'
  },
  {
    name: 'Smart Watch',
    description: 'Track your fitness and receive notifications on the go.',
    price: 1500,
    stock: 30,
    category: 'Electronics',
    imageUrl: 'https://via.placeholder.com/300?text=Smart+Watch'
  },
  {
    name: 'Running Shoes',
    description: 'Comfortable running shoes for all terrains.',
    price: 3200,
    stock: 100,
    category: 'Apparel',
    imageUrl: 'https://via.placeholder.com/300?text=Shoes'
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
