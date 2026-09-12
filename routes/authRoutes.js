const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user'); // Capitalization matches your models/user.js

const JWT_SECRET = process.env.JWT_SECRET || 'teleGebeya_secret_key_2026';

// Register Route
router.post('/register', async (req, res) => {
  try {
    const { fullName, phone, password, role, shopName, telegramHandle } = req.body;

    if (!phone || !password || !fullName) {
      return res.status(400).json({ message: 'Please provide full name, phone number, and password' });
    }

    const existingUser = await User.findOne({ phone: phone.trim() });
    if (existingUser) {
      return res.status(400).json({ message: 'Phone number already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      fullName: fullName.trim(),
      phone: phone.trim(),
      password: hashedPassword,
      role: role || 'buyer',
      shopName: shopName || '',
      telegramHandle: telegramHandle || ''
    });
    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role, phone: user.phone }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        shopName: user.shopName,
        telegramHandle: user.telegramHandle
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error during registration' });
  }
});

// Login Route
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: 'Please provide phone and password' });
    }

    const user = await User.findOne({ phone: phone.trim() });
    if (!user) {
      return res.status(400).json({ message: 'Invalid phone number or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid phone number or password' });
    }

    const token = jwt.sign({ id: user._id, role: user.role, phone: user.phone }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        shopName: user.shopName,
        telegramHandle: user.telegramHandle
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error during sign in' });
  }
});

module.exports = router;