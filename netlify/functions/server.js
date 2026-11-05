const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');
const { initDatabase, initShopSettings } = require('./lib/db');

// Импорт роутов
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

// ═══ Безопасность и парсинг ═══
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ═══ Инициализация БД (один раз) ═══
let initialized = false;
let initError = null;

async function ensureInit() {
  if (initialized) return true;
  try {
    await initDatabase();
    await initShopSettings();
    initialized = true;
    return true;
  } catch (error) {
    initError = error.message;
    console.error('❌ Ошибка инициализации:', error);
    return false;
  }
}

// Мидлвар — инициализация при первом запросе
app.use(async (req, res, next) => {
  if (req.path === '/api/test' || req.path === '/api/ping') return next();
  await ensureInit();
  next();
});

// ═══ Health Check ═══
app.get('/api/test', (req, res) => {
  res.json({
    ok: true,
    initialized,
    initError,
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

app.get('/api/ping', (req, res) => res.send('pong'));

// ═══ API Роуты ═══
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api', orderRoutes);           // /create-order, /orders/:id/cancel
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);     // /api/admin/check, /api/admin/users, /api/admin/orders
app.use('/api', productRoutes);         // /api/products
app.use('/api', newsRoutes);            // /api/news
app.use('/api', reviewRoutes);          // /api/reviews
app.use('/api', promocodeRoutes);       // /api/promocodes/check, /api/promocodes/activate

// ═══ 404 для несуществующих API ═══
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, error: 'API route not found' });
});

// ═══ Глобальный обработчик ошибок ═══
app.use((err, req, res, next) => {
  console.error('❌ Express error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Внутренняя ошибка сервера' 
      : err.message
  });
});

// ═══ Экспорт ═══
module.exports.handler = serverless(app);