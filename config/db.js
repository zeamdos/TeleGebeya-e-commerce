const mongoose = require('mongoose');

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing from .env');
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });
    console.log('MongoDB connected successfully!');
  } catch (err) {
    throw new Error(`MongoDB connection failed: ${err.message}`);
  }
};

module.exports = connectDB;