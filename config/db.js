const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is missing from .env');
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'telegebeya_db', // Forces database name
    });
    console.log('MongoDB connected successfully with production optimizations!');
  } catch (err) {
    throw new Error(`MongoDB connection failed: ${err.message}`);
  }
};

module.exports = connectDB;