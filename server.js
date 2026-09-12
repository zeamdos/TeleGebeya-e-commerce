const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4'])
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const healthRoute = require('./routes/health');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', healthRoute);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);

const path = require('path');
const fs = require('fs');

const frontendDist = path.join(__dirname, 'frontend', 'dist', 'frontend', 'browser');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(frontendDist, 'index.html'));
    }
    next();
  });
} else {
  // Add a root route so the browser doesn't show "Cannot GET /"
  app.get('/', (req, res) => {
    res.json({ message: 'TeleGebeya Marketplace API is running...', status: 'OK' });
  });
}

const PORT = process.env.PORT || 5000;

connectDB()
	.then(() => app.listen(PORT, () => console.log(`Server running on port ${PORT}`)))
	.catch((err) => {
		console.error(err.message);
		process.exit(1);
	});