const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');
const { initDatabase, initShopSettings } = require('./lib/db');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const orderRoutes = require('./routes/orders');
const chatRoutes = require('./routes/chat');
const adminRoutes = require('./routes/admin');
const productRoutes = require('./routes/products');
const newsRoutes = require('./routes/news');
const reviewRoutes = require('./routes/reviews');
const promocodeRoutes = require('./routes/promocodes');

const app = express();

app.use(cors());
app.use(express.json());

// Ленивая инициализация БД (чтобы Netlify не падал при сборке)
let initialized = false;
app.use(async (req, res, next) => {
  if (!initialized) {
    try {
      await initDatabase();
      await initShopSettings();
      initialized = true;
    } catch (e) { console.error(e); }
  }
  next();
});

// Подключение роутов
app.use('/api', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api', orderRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', productRoutes);
app.use('/api', newsRoutes);
app.use('/api', reviewRoutes);
app.use('/api', promocodeRoutes);
app.get('/api/test', (req, res) => res.json({ ok: true }));

module.exports.handler = serverless(app);