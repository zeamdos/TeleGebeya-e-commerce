const jwt = require('jsonwebtoken');
const User = require('../models/user');

const JWT_SECRET = process.env.JWT_SECRET || 'teleGebeya_secret_key_2026';

const hydrateUser = async (decoded) => {
  try {
    const doc = await User.findById(decoded.id)
      .select('-password')
      .lean()
      .exec();
    if (!doc) return { id: decoded.id, role: decoded.role || 'buyer' };
    return {
      id: String(doc._id),
      _id: String(doc._id),
      role: doc.role || 'buyer',
      fullName: doc.fullName || '',
      phone: doc.phone || '',
      shopName: doc.shopName || '',
      telegramHandle: doc.telegramHandle || '',
      banned: !!doc.banned,
    };
  } catch (e) {
    return { id: decoded.id, role: decoded.role || 'buyer' };
  }
};

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = await hydrateUser(decoded);
      if (req.user && req.user.banned) {
        return res.status(403).json({ message: 'ይህ መለያ ተሰርዟል። እባክዎ ደወዳጆችን ያግኙ።' });
      }
      return next();
    } catch (error) {
      return res.status(401).json({ message: 'ተገቢያ ፈቃድዎ ተቋርጧል፣ እባክዎ እንደገና ይግቡ።' });
    }
  }

  return res.status(401).json({ message: 'ይህን ገጽ ለማየት መግቢያ አስፈላጊ ነው።' });
};

const optionalProtect = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      if (token && token !== 'null' && token !== 'undefined') {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = await hydrateUser(decoded);
      }
    } catch (_error) {
      // Ignore token decode error for optional auth
    }
  }
  next();
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin' && !req.user.banned) {
    next();
  } else {
    res.status(403).json({ message: 'ለአድሚን ብቻ ነው።' });
  }
};

module.exports = { protect, optionalProtect, admin };
