const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4'])
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
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

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api', healthRoute);
app.use('/api/config', configRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);

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

if (process.env.BOT_WEBHOOK_DOMAIN) {
  app.use(bot.webhookPath, bot.webhookCallback(bot.webhookPath));
}
app.use(express.json({ limit: '10mb' }));

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
