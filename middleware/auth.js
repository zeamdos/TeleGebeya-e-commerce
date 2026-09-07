const jwt = require('jsonwebtoken');

// Keep ONE consistent secret key across all backend files
const JWT_SECRET = process.env.JWT_SECRET || 'teleGebeya_secret_key_2026';

module.exports = function (req, res, next) {
  const authHeader = req.header('Authorization');

  if (!authHeader) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const token = authHeader.split(' ')[1] || authHeader;
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded; // Standardized user payload
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};