// netlify/functions/server.js — ПОЛНЫЙ ПЕРЕПИСАННЫЙ
const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');
const helmet = require('helmet');

const { initDatabase, initShopSettings } = require('./lib/db');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const orderRoutes = require('./routes/orders');
const chatRoutes = require('./routes/chat');
const adminRoutes = require('./routes/admin');
const promocodeRoutes = require('./routes/promocodes');
const reviewRoutes = require('./routes/reviews');
const newsRoutes = require('./routes/news');
const productRoutes = require('./routes/products');

const app = express();

// --- Безопасность ---
app.use(helmet({
  contentSecurityPolicy: false, // ломается из-за inline-скриптов; настраивать отдельно
  crossOriginEmbedderPolicy: false,
}));

// --- CORS ---
const ALLOWED_ORIGINS = (process.env.PUBLIC_URL || 'https://bhstore.netlify.app')
  .split(',').map(s => s.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '5mb' }));

// --- Инициализация (один раз при cold start) ---
let initialized = false;
async function ensureInit() {
  if (initialized) return;
  try {
    await initDatabase();
    await initShopSettings();
    initialized = true;
  } catch (e) {
    console.error('❌ Init failed:', e.message);
  }
}

// --- Middleware: lazy-init ---
app.use(async (req, res, next) => {
  if (req.path === '/api/test') return next();
  await ensureInit();
  next();
});

// --- Роуты ---
app.use('/api', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api', orderRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/promocodes', promocodeRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/products', productRoutes);

app.get('/api/test', (req, res) => res.json({ ok: true, ts: Date.now() }));

// --- Error handler (последний!) ---
app.use((err, req, res, next) => {
  console.error('❌ Express error:', err.message);
  res.status(500).json({ success: false, error: 'Internal error' });
});

module.exports.handler = serverless(app);