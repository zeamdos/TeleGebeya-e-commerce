const dns = require('dns');
//dns.setServers(['8.8.8.8', '8.8.4.4'])
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
//const mongoSanitize = require('express-mongo-sanitize');
const connectDB = require('./config/db');
   const mongoose = require('mongoose');
const { seedAdminUser } = require('./controllers/adminController');

const healthRoute = require('./routes/health');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const configRoutes = require('./routes/configRoutes');
const bot = require('./bot');
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for Telegram webview compatibility
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // login/register attempts allowed per IP
  message: 'Too many authentication attempts, please try again later.'
});

app.use('/api', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use(cors({
  origin: '*', // Temporarily allow all origins for debugging
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Add URL encoding support

   //mongoose.set('sanitizeFilter', true);

   function stripUnsafeKeys(obj) {
     if (!obj || typeof obj !== 'object') return;
     for (const key of Object.keys(obj)) {
       if (key.startsWith('$') || key.includes('.')) {
         delete obj[key];
       } else {
         stripUnsafeKeys(obj[key]);
       }
     }
   }

   app.use((req, res, next) => {
     stripUnsafeKeys(req.body);
     next();
   });

app.use('/api', healthRoute);
app.use('/api/config', configRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);

// Telegram webhook route
if (process.env.BOT_WEBHOOK_DOMAIN) {
  app.use(bot.webhookPath, bot.webhookCallback(bot.webhookPath));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

const path = require('path');
const fs = require('fs');

const browserDist = path.join(__dirname, 'frontend', 'dist', 'frontend', 'browser');
const serverDist = path.join(__dirname, 'frontend', 'dist', 'frontend', 'server');
if (fs.existsSync(browserDist)) {
  // 1. Serve JavaScript and CSS assets from the browser folder
  app.use(express.static(browserDist));

  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(serverDist, 'index.server.html'));
    }
    next();
  });
}

 else {
  app.get('/', (req, res) => {
    res.json({ message: 'TeleGebeya Marketplace API is running...', status: 'OK' });
  });
}



const PORT = process.env.PORT || 5000;

connectDB()
	.then(async () => {
    await seedAdminUser();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
	.catch((err) => {
		console.error(err.message);
		process.exit(1);
	});
