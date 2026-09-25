// ============================================================
// BHStore Backend — server.js
// Netlify Functions + Express + Neon PostgreSQL
// ============================================================

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const serverless = require('serverless-http');
const { neon } = require('@neondatabase/serverless');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

require('dotenv').config();

// ============================================================
// ENV + ВАЛИДАЦИЯ
// ============================================================

const REQUIRED_ENV = [
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'JWT_SECRET',
  'TELEGRAM_BOT_TOKEN',
  'RECAPTCHA_SECRET_KEY',
  'DATABASE_URL'
];

const OPTIONAL_ENV_DEFAULTS = {
  DISCORD_REDIRECT_URI: 'https://bhstore.netlify.app/auth/discord/callback',
  RECAPTCHA_SITE_KEY: '6LfunBMtAAAAAERlHV1wjXssrw5yYmgPUmxvVUAQ',
  PUBLIC_URL: 'https://bhstore.netlify.app'
};

const missingEnv = REQUIRED_ENV.filter(key => !process.env[key]);
if (missingEnv.length > 0) {
  console.error('❌ ОТСУТСТВУЮТ ENV ПЕРЕМЕННЫЕ:', missingEnv.join(', '));
  console.error('⚠️ Сервер продолжит работу, но соответствующие функции будут недоступны');
}

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || OPTIONAL_ENV_DEFAULTS.DISCORD_REDIRECT_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const RECAPTCHA_SITE_KEY = process.env.RECAPTCHA_SITE_KEY || OPTIONAL_ENV_DEFAULTS.RECAPTCHA_SITE_KEY;
const PUBLIC_URL = process.env.PUBLIC_URL || OPTIONAL_ENV_DEFAULTS.PUBLIC_URL;
const DATABASE_URL = process.env.DATABASE_URL;

// Webhooks (все в .env)
const WEBHOOK_CHAT = process.env.DISCORD_WEBHOOK_CHAT || '';
const WEBHOOK_VERIFY = process.env.DISCORD_WEBHOOK_VERIFY || '';
const WEBHOOK_PURCHASE = process.env.DISCORD_WEBHOOK_PURCHASE || '';
const WEBHOOK_REVIEW = process.env.DISCORD_WEBHOOK_REVIEW || '';
const WEBHOOK_WELCOME = process.env.DISCORD_WEBHOOK_WELCOME || '';
const WEBHOOK_NEWS = process.env.DISCORD_WEBHOOK_NEWS || '';
const WEBHOOK_ADMIN = process.env.DISCORD_WEBHOOK_ADMIN || '';

// Hardcoded admin ID (для совместимости) — лучше вынести в .env
const HARDCODED_ADMIN_ID = process.env.ADMIN_ID || '992442453833547886';

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('❌ JWT_SECRET не задан или слишком короткий (мин. 32 символа). JWT-авторизация будет недоступна.');
}

// ============================================================
// ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ ОШИБОК
// ============================================================

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  console.error(err.stack);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err?.message || err);
});

// ============================================================
// DECODE AUTH TOKEN (JWT ONLY — base64 фолбэк убран)
// ============================================================

function decodeAuthToken(token) {
  if (!token) return null;
  if (!JWT_SECRET) return null;

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (jwtError) {
    return null;
  }
}

// ============================================================
// EXPRESS APP
// ============================================================

const app = express();

// ---------- Безопасность (headers) ----------
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// ---------- CORS (один раз, с credentials) ----------
const ALLOWED_ORIGINS = [
  PUBLIC_URL,
  'https://bhstore.netlify.app',
  'http://localhost:3000',
  'http://localhost:8888'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // curl / server-to-server
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(null, true); // не блокируем, но credentials ниже
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());

// ---------- Body parsing ----------
app.use(express.json({ limit: '5mb' }));

// ---------- Static (для локальной разработки) ----------
app.use(express.static(path.join(__dirname, '../../')));

// ============================================================
// RATE LIMITERS
// ============================================================

// Простой in-memory rate limiter без зависимости express-rate-limit
function createRateLimiter({ windowMs, max, message }) {
  const hits = new Map();

  // Очистка
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of hits.entries()) {
      if (data.resetAt < now) hits.delete(key);
    }
  }, 5 * 60 * 1000).unref?.();

  return (req, res, next) => {
    const key = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count++;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({ success: false, error: message || 'Слишком много запросов' });
    }

    next();
  };
}

const telegramLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Слишком много попыток Telegram. Подождите 15 минут.'
});

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Слишком много попыток авторизации. Подождите 15 минут.'
});

const chatLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Слишком много сообщений. Подождите минуту.'
});

// ============================================================
// TELEGRAM CODES (in-memory, автоочистка)
// ============================================================

if (!global.telegramCodes) global.telegramCodes = {};

setInterval(() => {
  const now = Date.now();
  let deleted = 0;
  for (const [key, value] of Object.entries(global.telegramCodes)) {
    if (value.expiresAt < now) {
      delete global.telegramCodes[key];
      deleted++;
    }
  }
  if (deleted > 0) console.log(`🧹 Очищено ${deleted} просроченных Telegram-кодов. Осталось: ${Object.keys(global.telegramCodes).length}`);
}, 5 * 60 * 1000).unref?.();

// ============================================================
// DATABASE INIT
// ============================================================

let sql = null;
try {
  if (DATABASE_URL) {
    sql = neon(DATABASE_URL);
    (async () => {
      try {
        await sql`SELECT 1`;
        console.log('✅ Подключено к Neon');
      } catch (err) {
        console.error('❌ Ошибка подключения к Neon:', err.message);
      }
    })();
  } else {
    console.log('⚠️ DATABASE_URL не установлен, работаем без БД');
  }
} catch (error) {
  console.error('❌ Ошибка инициализации Neon:', error.message);
  sql = null;
}

// Fallback in-memory хранилища (на случай отсутствия БД)
let users = {};
let chatStore = {};
let reviewsData = { reviews: [], stats: { totalReviews: 0, averageRating: 0, verifiedPurchases: 0, totalHelpful: 0 } };
let promocodes = {};
let demoNews = [];

// ============================================================
// ESCAPE HTML (объявлена наверх)
// ============================================================

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function (m) {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#039;';
      default: return m;
    }
  });
}

// ============================================================
// БД: ИНИЦИАЛИЗАЦИЯ
// ============================================================

async function initDatabase() {
  if (!sql) {
    console.log('⚠️ БД недоступна, пропускаем инициализацию');
    return;
  }

  try {
    // -------- news --------
    await sql`
      CREATE TABLE IF NOT EXISTS news (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        date DATE DEFAULT CURRENT_DATE,
        category TEXT DEFAULT 'announcement',
        views INTEGER DEFAULT 0,
        author TEXT DEFAULT 'BHStore',
        tags JSONB DEFAULT '[]',
        image TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // -------- users --------
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        discord_id TEXT PRIMARY KEY,
        username TEXT,
        email TEXT,
        avatar TEXT,
        password TEXT,
        balance INTEGER DEFAULT 0,
        badges JSONB DEFAULT '{}',
        orders JSONB DEFAULT '[]',
        used_promocodes JSONB DEFAULT '[]',
        active_promocodes JSONB DEFAULT '[]',
        privacy JSONB DEFAULT '{"show_avatar":true,"show_orders":true,"show_badges":true,"show_spent":true,"show_orders_count":true,"show_registered":true,"hide_profile":false}',
        frozen BOOLEAN DEFAULT FALSE,
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Добавляем недостающие колонки (для старых БД)
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy JSONB DEFAULT '{"show_avatar":true,"show_orders":true,"show_badges":true,"show_spent":true,"show_orders_count":true,"show_registered":true,"hide_profile":false}'`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS frozen BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS active_promocodes JSONB DEFAULT '[]'`;

    // -------- messages --------
    await sql`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(discord_id) ON DELETE CASCADE,
        message TEXT,
        from_admin BOOLEAN DEFAULT FALSE,
        read BOOLEAN DEFAULT FALSE,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // -------- reviews --------
    await sql`
      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(discord_id) ON DELETE CASCADE,
        name TEXT,
        avatar TEXT,
        product_id TEXT,
        product_name TEXT,
        rating INTEGER,
        text TEXT,
        images JSONB DEFAULT '[]',
        verified_purchase BOOLEAN DEFAULT FALSE,
        verified BOOLEAN DEFAULT FALSE,
        helpful INTEGER DEFAULT 0,
        admin_reply JSONB,
        created_at TIMESTAMP,
        updated_at TIMESTAMP
      )
    `;

    // -------- promocodes --------
    await sql`
      CREATE TABLE IF NOT EXISTS promocodes (
        code TEXT PRIMARY KEY,
        type TEXT,
        value INTEGER,
        active BOOLEAN DEFAULT TRUE,
        max_uses INTEGER,
        used_count INTEGER DEFAULT 0,
        used_by JSONB DEFAULT '[]',
        valid_from TIMESTAMP,
        valid_until TIMESTAMP,
        expires_at TIMESTAMP,
        valid_days INTEGER DEFAULT 0,
        max_uses_per_user INTEGER DEFAULT 1,
        product_ids JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`ALTER TABLE promocodes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`;
    await sql`ALTER TABLE promocodes ADD COLUMN IF NOT EXISTS max_uses_per_user INTEGER DEFAULT 1`;
    await sql`ALTER TABLE promocodes ADD COLUMN IF NOT EXISTS product_ids JSONB DEFAULT '[]'`;

    // -------- notifications --------
    await sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(discord_id) ON DELETE CASCADE,
        type TEXT,
        title TEXT,
        message TEXT,
        data JSONB,
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP
      )
    `;

    // -------- errors --------
    await sql`
      CREATE TABLE IF NOT EXISTS errors (
        id TEXT PRIMARY KEY,
        type TEXT,
        message TEXT,
        user_id TEXT REFERENCES users(discord_id) ON DELETE SET NULL,
        user_agent TEXT,
        url TEXT,
        created_at TIMESTAMP
      )
    `;

    // -------- stats --------
    await sql`
      CREATE TABLE IF NOT EXISTS stats (
        id SERIAL PRIMARY KEY,
        data JSONB,
        created_at TIMESTAMP
      )
    `;

    // -------- transactions --------
    await sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(discord_id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        type TEXT CHECK (type IN ('deposit', 'withdrawal', 'purchase')),
        reason TEXT,
        admin_id TEXT,
        admin_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // -------- products --------
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price INTEGER NOT NULL,
        category TEXT,
        icon TEXT,
        image TEXT,
        features JSONB DEFAULT '[]',
        popular BOOLEAN DEFAULT FALSE,
        discount INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // -------- shop_settings --------
    await sql`
      CREATE TABLE IF NOT EXISTS shop_settings (
        id SERIAL PRIMARY KEY,
        setting_key TEXT UNIQUE NOT NULL,
        setting_value BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by TEXT
      )
    `;

    // -------- auth_sessions (⚠️ БЫЛО ПРОПУЩЕНО) --------
    await sql`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT,
        username TEXT,
        name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at)`;

    console.log('✅ БД инициализирована (все таблицы включая auth_sessions)');
  } catch (error) {
    console.error('❌ Ошибка инициализации БД:', error.message);
  }
}

async function initShopSettings() {
  if (!sql) return;

  const defaults = [
    { key: 'shop_open', value: true },
    { key: 'auth_enabled', value: true },
    { key: 'registration_enabled', value: true },
    { key: 'site_access', value: true }
  ];

  try {
    for (const s of defaults) {
      const [exists] = await sql`SELECT 1 FROM shop_settings WHERE setting_key = ${s.key}`;
      if (!exists) {
        await sql`
          INSERT INTO shop_settings (setting_key, setting_value, updated_at)
          VALUES (${s.key}, ${s.value}, CURRENT_TIMESTAMP)
        `;
      }
    }
    console.log('✅ Настройки магазина инициализированы');
  } catch (e) {
    console.error('❌ Ошибка initShopSettings:', e.message);
  }
}

// ============================================================
// ТОВАРЫ
// ============================================================

function getTestProducts() {
  return [
    {
      "id": "discord_bot_economy",
      "name": "Экономический бот",
      "description": "Экономический бот, который поможет вам умело управлять экономикой!",
      "price": 999,
      "category": "discordbot",
      "icon": "image/emoji/shop_discord.png",
      "features": [
        "ЯП: Python", "База данных - JSON или DATABASE",
        "Команды: !хелп, !баланс, !ограбить, !монетка, !топ, !продать, !купить-товар, !вывести, !положить, !профиль, !работа, !казино, !магазин, !добавить-товар, !убрать-товар, !выдать-монеты, !снять-монеты.",
        "Настройки: !настройки - Настроить основные элементы экономики",
        "Выбор формата команд - Slash или Default Commands",
        "Язык команд на ваше усмотрение - Русский(!хелп) или Английский(!help)",
        "Язык ответа на ваше усмотрение - Русский или Английский",
        "Дизайн эмодзи на выбор - Белый, Синий, Фиолетовый, Красный.",
        "Гарантия 2 недели"
      ]
    },
    {
      "id": "discord_bot_moderation",
      "name": "Модераторский бот",
      "description": "Модераторский бот, в котором есть все основные команды модерации и не только!",
      "price": 1119,
      "category": "discordbot",
      "icon": "image/emoji/shop_discord.png",
      "features": [
        "ЯП: Python", "База данных - JSON или DATABASE",
        "Команды: !хелп, !бан, !банлист, !разбан, !варн, !варнлист, !варнснять, !мьют, !размьют, !мутлист, !войскик, !изменить-ник.",
        "Настройки: !настройки - Настроить основные элементы модерации",
        "Выбор формата команд - Slash или Default Commands",
        "Язык команд на ваше усмотрение - Русский(!хелп) или Английский(!help)",
        "Язык ответа на ваше усмотрение - Русский или Английский",
        "Дизайн эмодзи на выбор - Белый, Синий, Фиолетовый, Красный.",
        "Гарантия 2 недели"
      ]
    },
    {
      "id": "discord_bot_levels",
      "name": "Уровень бот",
      "description": "Уровневый бот, который поможет вам отслежить активность пользователей в вашем Discord сервере!",
      "price": 888,
      "category": "discordbot",
      "icon": "image/emoji/shop_discord.png",
      "features": [
        "ЯП: Python", "База данных - JSON или DATABASE",
        "Команды: !хелп, !ранг, !выдать-опыт, !снять-опыт, !выдать-уровень, !снять-уровень, !топ, !общий-сброс.",
        "Настройки: !настройки - Настроить выдачу роли, оповещение, награды.",
        "Выбор формата команд - Slash или Default Commands",
        "Язык команд на ваше усмотрение - Русский(!хелп) или Английский(!help)",
        "Язык ответа на ваше усмотрение - Русский или Английский",
        "Дизайн эмодзи на выбор - Белый, Синий, Фиолетовый, Красный.",
        "Гарантия 2 недели"
      ]
    },
    {
      "id": "discord_bot_all",
      "name": "Полноценный бот",
      "description": "Полный пакет всех тарифов ботов.",
      "price": 1999,
      "category": "discordbot",
      "icon": "image/emoji/shop_discord.png",
      "features": [
        "ЯП: Python",
        "В этот Тариф входят другие тарифы: Экономический бот, Модераторский бот, Уровень бот",
        "Команды: !хелп, !профиль, !сервер, !бот...",
        "Выбор формата команд - Slash или Default Commands",
        "Язык команд на ваше усмотрение - Русский(!хелп) или Английский(!help)",
        "Язык ответа на ваше усмотрение - Русский или Английский",
        "Дизайн эмодзи на выбор - Любого цвета и Любые эмодзи",
        "Гарантия 1 мес."
      ]
    },
    {
      "id": "discord_guild_full",
      "name": "Полная настройка Discord сервера",
      "description": "Discord сервер будет в безопастности!",
      "price": 999,
      "category": "discord",
      "icon": "image/emoji/shop_discord.png",
      "features": [
        "1. Полная настройка всех настроек функций Discord",
        "2. Авто-модерация (Bot ИЛИ Discord)",
        "3. Каналы-роли (выбор ролей или авторизация)",
        "4. Дизайн Каналы, Категории, Роли, Голосовые, Трибуны, Форумы",
        "5. Настройка прав для всех каналов",
        "6. Настроенные сообщения и публикации"
      ]
    },
    {
      "id": "video_montaz_easy",
      "name": "Монтаж",
      "description": "Уровень: Easy",
      "price": 499,
      "category": "youtube",
      "icon": "image/emoji/montaz.png",
      "features": ["Ролик от 5 сек. ДО 3 мин.", "Переходы", "Соеденинение клипов"]
    },
    {
      "id": "video_montaz_average",
      "name": "Монтаж для видео",
      "description": "Уровень: Average",
      "price": 899,
      "category": "youtube",
      "icon": "image/emoji/montaz.png",
      "features": ["Все что в уровне: Easy", "Ролик от 5 сек. ДО 10 мин.", "Изменение голосов", "Специальные эффекты", "Звуки"]
    },
    {
      "id": "video_montaz_high",
      "name": "Монтаж для видео",
      "description": "Уровень: High",
      "price": 1099,
      "category": "youtube",
      "icon": "image/emoji/montaz.png",
      "features": [
        "Все что в уровне: Easy и Average",
        "Ролик от 5 сек. ДО 30 мин.",
        "Проффесиональные переходы", "Проффесиональные спец.эффекты",
        "Проффесиональные звуки", "Проффесиональное изменение голосов",
        "Проффесиональное соединение клипов"
      ]
    },
    {
      "id": "ava",
      "name": "Аватарка",
      "description": "",
      "price": 1099,
      "category": "ava",
      "icon": "image/emoji/ava.png",
      "features": ["Скоро"]
    }
  ];
}

let productsData = [];
try {
  const productsPath = path.join(__dirname, '../../data/products.json');
  if (fs.existsSync(productsPath)) {
    productsData = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
    console.log(`✅ Загружено ${productsData.length} товаров из products.json`);
  } else {
    productsData = getTestProducts();
    console.log(`✅ Загружено ${productsData.length} тестовых товаров`);
  }
} catch (error) {
  console.error('❌ Ошибка загрузки товаров:', error.message);
  productsData = getTestProducts();
}

// ============================================================
// УТИЛИТЫ
// ============================================================

function isAdminUser(decoded) {
  if (!decoded) return false;
  return decoded.id === HARDCODED_ADMIN_ID;
}

async function isAdminUserAsync(decoded) {
  if (!decoded) return false;
  if (decoded.id === HARDCODED_ADMIN_ID) return true;

  if (sql) {
    try {
      const [user] = await sql`SELECT badges FROM users WHERE discord_id = ${decoded.id}`;
      return user?.badges?.admin === true;
    } catch { return false; }
  }
  return false;
}

function getAuthFromReq(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  return decodeAuthToken(token);
}

// Whitelist колонок для UPDATE
const USER_UPDATE_WHITELIST = ['username', 'email', 'avatar', 'balance', 'badges', 'privacy', 'frozen'];

// ============================================================
// TELEGRAM: verifyRecaptcha
// ============================================================

async function verifyRecaptcha(token) {
  if (!token || !RECAPTCHA_SECRET_KEY) return false;
  try {
    const response = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
      params: { secret: RECAPTCHA_SECRET_KEY, response: token }
    });
    return response.data.success === true;
  } catch (error) {
    console.error('❌ Ошибка проверки reCAPTCHA:', error.message);
    return false;
  }
}

// ============================================================
// ЗАПУСК ИНИЦИАЛИЗАЦИИ (ОДИН РАЗ)
// ============================================================

if (sql) {
  (async () => {
    await initDatabase();
    await initShopSettings();
  })();
}

// ============================================================
// ===================   ROUTES   =============================
// ============================================================

// ---------- HEALTH ----------
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Сервер работает',
    db: !!sql,
    stats: {
      users: Object.keys(users).length,
      chatSessions: Object.keys(chatStore).length,
      totalMessages: Object.values(chatStore).reduce((sum, msgs) => sum + msgs.length, 0),
      reviews: reviewsData.reviews?.length || 0,
      promocodes: Object.keys(promocodes).length
    }
  });
});

// ---------- SHOP SETTINGS ----------
app.get('/api/auth-status', async (req, res) => {
  try {
    if (!sql) return res.json({ success: true, auth_enabled: true });
    const [setting] = await sql`SELECT setting_value FROM shop_settings WHERE setting_key = 'auth_enabled'`;
    res.json({ success: true, auth_enabled: setting?.setting_value !== false });
  } catch (error) {
    console.error('❌ /api/auth-status:', error.message);
    res.json({ success: true, auth_enabled: true });
  }
});

app.get('/api/shop-settings', async (req, res) => {
  try {
    if (!sql) {
      return res.json({
        success: true,
        settings: { shop_open: true, auth_enabled: true, registration_enabled: true, site_access: true }
      });
    }

    const settings = await sql`SELECT setting_key, setting_value FROM shop_settings`;
    const settingsObj = {};
    settings.forEach(s => { settingsObj[s.setting_key] = s.setting_value; });

    res.json({ success: true, settings: settingsObj });
  } catch (error) {
    console.error('❌ /api/shop-settings:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка получения настроек' });
  }
});

app.post('/api/admin/shop-settings', authLimiter, async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });

    const { setting_key, setting_value } = req.body;
    if (!setting_key || setting_value === undefined) {
      return res.status(400).json({ success: false, error: 'Не указаны параметры' });
    }

    const allowedKeys = ['shop_open', 'auth_enabled', 'registration_enabled', 'site_access'];
    if (!allowedKeys.includes(setting_key)) {
      return res.status(400).json({ success: false, error: 'Недопустимый ключ настройки' });
    }

    if (sql) {
      await sql`
        UPDATE shop_settings
        SET setting_value = ${setting_value === true || setting_value === 'true'},
            updated_at = CURRENT_TIMESTAMP,
            updated_by = ${decoded.username || decoded.id}
        WHERE setting_key = ${setting_key}
      `;
    }

    res.json({ success: true, message: `Настройка "${setting_key}" обновлена`, setting: { key: setting_key, value: setting_value } });
  } catch (error) {
    console.error('❌ /api/admin/shop-settings:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка обновления настроек' });
  }
});

// ---------- PRODUCTS ----------
app.get('/api/products', async (req, res) => {
  console.log('📦 GET /api/products');

  if (sql) {
    try {
      const [setting] = await sql`SELECT setting_value FROM shop_settings WHERE setting_key = 'shop_open'`;
      if (setting?.setting_value === false) {
        return res.json({
          success: false,
          error: 'Магазин временно закрыт',
          products: [],
          total: 0,
          shop_closed: true
        });
      }
    } catch (error) {
      console.error('⚠️ /api/products shop_open check:', error.message);
    }
  }

  res.json({
    success: true,
    products: productsData,
    total: productsData.length,
    shop_open: true
  });
});

// ============================================================
// TELEGRAM AUTH
// ============================================================

// Отправка кода в Telegram
app.post('/api/telegram/send-code', telegramLimiter, async (req, res) => {
  try {
    const { id, name } = req.body;

    if (!id || !/^\d+$/.test(id)) {
      return res.status(400).json({ success: false, error: 'Неверный формат ID' });
    }
    if (!name || name.length < 2 || name.length > 50) {
      return res.status(400).json({ success: false, error: 'Имя должно быть от 2 до 50 символов' });
    }
    if (!TELEGRAM_BOT_TOKEN) {
      return res.status(500).json({ success: false, error: 'Telegram бот не настроен' });
    }

    const codesCount = Object.keys(global.telegramCodes).length;
    if (codesCount > 1000) {
      const sorted = Object.entries(global.telegramCodes).sort((a, b) => a[1].expiresAt - b[1].expiresAt);
      for (let i = 0; i < 100; i++) {
        if (sorted[i]) delete global.telegramCodes[sorted[i][0]];
      }
    }

    if (global.telegramCodes[id]) delete global.telegramCodes[id];

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    global.telegramCodes[id] = {
      code: verificationCode,
      name: name,
      expiresAt: expiresAt,
      attempts: 0,
      createdAt: Date.now()
    };

    const message = `🔐 **КОД АВТОРИЗАЦИИ BHStore**\n\nЗдравствуйте, ${escapeHtml(name)}!\n\nВаш код для входа: \`${verificationCode}\`\n\n⚠️ Никому не сообщайте код!\n⏰ Код действителен 5 минут.\n\n✅ Код можно использовать ТОЛЬКО ОДИН РАЗ!`;

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: parseInt(id),
      text: message,
      parse_mode: 'Markdown'
    });

    res.json({ success: true, message: 'Код отправлен в Telegram', expiresIn: 300 });
  } catch (error) {
    console.error('❌ /api/telegram/send-code:', error.message);

    let errorMessage = 'Ошибка отправки кода. Проверьте ID и что бот не заблокирован';
    if (error.response?.data?.description) {
      const desc = error.response.data.description;
      if (desc.includes('chat not found')) errorMessage = '❌ Пользователь не найден! Напишите боту @Meentioned_bot команду /start';
      else if (desc.includes('bot was blocked')) errorMessage = '❌ Бот заблокирован! Разблокируйте @Meentioned_bot';
      else if (desc.includes('Forbidden')) errorMessage = '❌ Доступ запрещен! Напишите боту @Meentioned_bot команду /start';
      else errorMessage = desc;
    }

    res.status(500).json({ success: false, error: errorMessage });
  }
});

// Telegram авторизация через deep link
app.post('/api/auth/telegram/deep', authLimiter, async (req, res) => {
  try {
    const { code, telegram_id } = req.body;

    if (!code || !telegram_id) {
      return res.status(400).json({ success: false, error: 'Не указаны параметры' });
    }

    const userId = `tg_${telegram_id}`;
    const username = `Telegram_${telegram_id}`;

    const userData = {
      id: userId,
      username: username,
      avatar: null,
      email: `${userId}@telegram.bhstore`,
      authMethod: 'telegram'
    };

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    if (sql) {
      await sql`
        INSERT INTO auth_sessions (token, user_id, username, name, created_at, expires_at)
        VALUES (${token}, ${telegram_id}, ${username}, ${username}, NOW(), ${expiresAt.toISOString()})
        ON CONFLICT (token) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          username = EXCLUDED.username,
          name = EXCLUDED.name,
          expires_at = EXCLUDED.expires_at
      `;
    }

    const jwtToken = jwt.sign(userData, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token: jwtToken, user: userData });
  } catch (error) {
    console.error('❌ /api/auth/telegram/deep:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Статус Telegram бота (ОДИН раз)
app.get('/api/telegram/status', async (req, res) => {
  try {
    if (!TELEGRAM_BOT_TOKEN) {
      return res.json({ success: false, status: 'error', error: 'TELEGRAM_BOT_TOKEN не задан' });
    }
    const response = await axios.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
    res.json({ success: true, bot: response.data.result, status: 'active' });
  } catch (error) {
    res.json({ success: false, status: 'error', error: error.message });
  }
});

// Редирект на HTML callback
app.get('/api/auth/telegram/callback', (req, res) => {
  const url = `/auth/telegram/callback?${new URLSearchParams(req.query).toString()}`;
  res.redirect(url);
});

// Создание сессии для Telegram авторизации
app.post('/api/telegram/create-session', telegramLimiter, async (req, res) => {
  try {
    const { recaptchaToken } = req.body;
    const isHuman = await verifyRecaptcha(recaptchaToken);
    if (!isHuman) {
      return res.status(400).json({ success: false, error: 'Пожалуйста, подтвердите, что вы не робот' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    if (sql) {
      await sql`
        INSERT INTO auth_sessions (token, user_id, username, name, created_at, expires_at)
        VALUES (${token}, 'pending', 'pending', 'pending', NOW(), ${expiresAt.toISOString()})
        ON CONFLICT (token) DO UPDATE SET expires_at = ${expiresAt.toISOString()}
      `;
    }

    const botLink = `https://t.me/Meentioned_bot?start=${token}`;
    res.json({ success: true, botLink, token, expiresIn: 600 });
  } catch (error) {
    console.error('❌ /api/telegram/create-session:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// HTML callback для Telegram
app.get('/auth/telegram/callback', async (req, res) => {
  try {
    const { token, telegram_id, username, name } = req.query;

    if (!token || !telegram_id) {
      return res.status(400).send('Ошибка: недостаточно параметров');
    }

    let session = null;
    if (sql) {
      const [row] = await sql`SELECT * FROM auth_sessions WHERE token = ${token} AND expires_at > NOW()`;
      session = row;
    }

    if (!session) {
      return res.status(400).send('Сессия истекла или не найдена. Запросите новую ссылку.');
    }

    if (sql) {
      await sql`
        UPDATE auth_sessions
        SET user_id = ${telegram_id}, username = ${username || ''}, name = ${name || ''}
        WHERE token = ${token}
      `;
    }

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Завершение регистрации | BHStore</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://www.google.com/recaptcha/api.js" async defer></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:linear-gradient(135deg,#0f172a 0%,#0a0a0f 100%);color:#fff;font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}
.container{background:rgba(42,43,54,.95);backdrop-filter:blur(10px);padding:40px;border-radius:24px;border:1px solid #40444b;max-width:450px;width:100%}
h2{margin-bottom:25px;text-align:center;color:#5865F2}
.form-group{margin-bottom:20px}
label{display:block;margin-bottom:8px;color:#b9bbbe;font-size:.9rem}
input{width:100%;padding:12px 16px;background:#1e1f29;border:1px solid #40444b;border-radius:12px;color:#fff;font-size:1rem}
input:focus{outline:none;border-color:#5865F2}
.info-box{background:#1e1f29;padding:15px;border-radius:12px;margin-bottom:20px;border-left:3px solid #57F287}
.info-box p{margin:5px 0;color:#b9bbbe;font-size:.85rem}
.info-box strong{color:#fff}
.g-recaptcha{display:flex;justify-content:center;margin:20px 0}
button{width:100%;padding:14px;background:linear-gradient(135deg,#5865F2,#4752c4);color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:600;cursor:pointer}
button:disabled{opacity:.5;cursor:not-allowed}
.error-message{color:#ED4245;font-size:.85rem;margin-top:5px;display:none}
.success-message{color:#57F287;text-align:center;margin-top:15px;display:none}
.optional{color:#72767d;font-size:.75rem;margin-top:4px}
</style>
</head>
<body>
<div class="container">
<h2>🔐 Завершение регистрации</h2>
<div class="info-box">
<p><strong>👤 Telegram аккаунт</strong></p>
<p>ID: <code>${escapeHtml(String(telegram_id))}</code></p>
<p>Имя: ${escapeHtml(name || username || 'Не указано')}</p>
</div>
<form id="registerForm">
<div class="form-group">
<label>📧 Email <span class="optional">(необязательно)</span></label>
<input type="email" id="email" placeholder="example@mail.com">
</div>
<div class="form-group">
<label>🔒 Пароль <span style="color:#ED4245">*</span></label>
<input type="password" id="password" required placeholder="Введите пароль">
<div class="optional">Минимум 6 символов</div>
</div>
<div class="form-group">
<label>🔒 Подтверждение <span style="color:#ED4245">*</span></label>
<input type="password" id="confirm_password" required placeholder="Повторите пароль">
</div>
<div class="g-recaptcha" data-sitekey="${RECAPTCHA_SITE_KEY}" data-callback="onCaptchaComplete"></div>
<div id="errorMsg" class="error-message"></div>
<div id="successMsg" class="success-message"></div>
<button type="submit" id="submitBtn" disabled>Завершить регистрацию</button>
</form>
</div>
<script>
let captchaCompleted = false;
function onCaptchaComplete(){captchaCompleted=true;const b=document.getElementById('submitBtn');if(b)b.disabled=false}
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password=document.getElementById('password').value;
  const confirmPassword=document.getElementById('confirm_password').value;
  const email=document.getElementById('email').value;
  const errorMsg=document.getElementById('errorMsg');
  const successMsg=document.getElementById('successMsg');
  const submitBtn=document.getElementById('submitBtn');
  errorMsg.style.display='none';successMsg.style.display='none';
  if(!captchaCompleted){errorMsg.textContent='Подтвердите, что вы не робот';errorMsg.style.display='block';return}
  if(password.length<6){errorMsg.textContent='Пароль минимум 6 символов';errorMsg.style.display='block';return}
  if(password!==confirmPassword){errorMsg.textContent='Пароли не совпадают';errorMsg.style.display='block';return}
  const recaptchaResponse=grecaptcha.getResponse();
  if(!recaptchaResponse){errorMsg.textContent='Подтвердите, что вы не робот';errorMsg.style.display='block';return}
  submitBtn.disabled=true;submitBtn.textContent='Обработка...';
  try{
    const response=await fetch('/api/auth/telegram/complete',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        token:'${escapeHtml(String(token))}',
        telegram_id:'${escapeHtml(String(telegram_id))}',
        username:'${escapeHtml(username || '')}',
        name:'${escapeHtml(name || '')}',
        email:email,password:password,recaptchaToken:recaptchaResponse
      })
    });
    const data=await response.json();
    if(data.success){
      localStorage.setItem('bhstore_auth',JSON.stringify({id:data.user.id,username:data.user.username,email:data.user.email,token:data.token,authMethod:'telegram'}));
      successMsg.textContent='✅ Регистрация успешна! Перенаправление...';successMsg.style.display='block';
      setTimeout(()=>{window.location.href='/profile.html'},2000);
    } else {
      errorMsg.textContent=data.error||'Ошибка регистрации';errorMsg.style.display='block';
      submitBtn.disabled=false;submitBtn.textContent='Завершить регистрацию';
      grecaptcha.reset();captchaCompleted=false;
    }
  } catch(err){
    errorMsg.textContent='Ошибка сервера';errorMsg.style.display='block';
    submitBtn.disabled=false;submitBtn.textContent='Завершить регистрацию';
  }
});
</script>
</body>
</html>`;

    res.send(html);
  } catch (error) {
    console.error('❌ /auth/telegram/callback:', error.message);
    res.status(500).send('Ошибка сервера');
  }
});

// Завершение регистрации Telegram (ОДИН раз — был дубликат)
app.post('/api/auth/telegram/complete', authLimiter, async (req, res) => {
  try {
    const { token, telegram_id, username, name, email, password, recaptchaToken } = req.body;

    const isHuman = await verifyRecaptcha(recaptchaToken);
    if (!isHuman) {
      return res.status(400).json({ success: false, error: 'Пожалуйста, подтвердите, что вы не робот' });
    }

    if (!token || !telegram_id || !password) {
      return res.status(400).json({ success: false, error: 'Не указаны обязательные поля' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Пароль минимум 6 символов' });
    }

    let session = null;
    if (sql) {
      const [row] = await sql`SELECT * FROM auth_sessions WHERE token = ${token} AND expires_at > NOW()`;
      session = row;
    }

    if (!session) {
      return res.status(400).json({ success: false, error: 'Сессия истекла. Запросите новую ссылку' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = `tg_${telegram_id}`;
    const userDisplayName = name || username || `Telegram_${telegram_id}`;
    const userEmail = email && email.includes('@') ? email : null;

    if (sql) {
      const [existingUser] = await sql`SELECT * FROM users WHERE discord_id = ${userId}`;

      if (existingUser) {
        await sql`
          UPDATE users
          SET username = ${userDisplayName}, email = ${userEmail}, password = ${hashedPassword}
          WHERE discord_id = ${userId}
        `;
      } else {
        await sql`
          INSERT INTO users (
            discord_id, username, email, avatar, balance, badges, orders, password, frozen, privacy
          ) VALUES (
            ${userId}, ${userDisplayName}, ${userEmail}, NULL, 0, '{}', '[]', ${hashedPassword}, false,
            '{"show_avatar":true,"show_orders":true,"show_badges":true,"show_spent":true,"show_orders_count":true,"show_registered":true,"hide_profile":false,"frozen":false}'
          )
        `;
      }

      await sql`DELETE FROM auth_sessions WHERE token = ${token}`;
    }

    const userData = {
      id: userId,
      username: userDisplayName,
      email: userEmail || `${userId}@telegram.bhstore`,
      authMethod: 'telegram'
    };

    const jwtToken = jwt.sign(userData, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: userId,
        username: userDisplayName,
        email: userEmail || `${userId}@telegram.bhstore`
      }
    });
  } catch (error) {
    console.error('❌ /api/auth/telegram/complete:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Авторизация через код Telegram
app.post('/api/auth/telegram', telegramLimiter, async (req, res) => {
  try {
    const { code, id, name } = req.body;

    if (!code || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ success: false, error: 'Неверный формат кода' });
    }
    if (!global.telegramCodes || !global.telegramCodes[id]) {
      return res.status(400).json({ success: false, error: 'Код не найден. Запросите новый' });
    }

    const saved = global.telegramCodes[id];

    saved.attempts = (saved.attempts || 0) + 1;
    if (saved.attempts > 3) {
      delete global.telegramCodes[id];
      return res.status(400).json({ success: false, error: 'Превышено количество попыток. Запросите новый код' });
    }

    if (saved.code !== code) {
      return res.status(400).json({ success: false, error: `Неверный код. Осталось попыток: ${3 - saved.attempts}` });
    }

    if (saved.expiresAt < Date.now()) {
      delete global.telegramCodes[id];
      return res.status(400).json({ success: false, error: 'Код истёк. Запросите новый' });
    }

    delete global.telegramCodes[id];

    const userId = `tg_${id}`;
    const userDisplayName = name || saved.name;

    const userData = {
      id: userId,
      username: userDisplayName,
      avatar: null,
      email: `${userId}@telegram.bhstore`,
      authMethod: 'telegram'
    };

    if (sql) {
      const [existing] = await sql`SELECT * FROM users WHERE discord_id = ${userId}`;
      if (!existing) {
        await sql`
          INSERT INTO users (discord_id, username, email, avatar, balance, badges, frozen, privacy)
          VALUES (${userId}, ${userDisplayName}, ${userData.email}, NULL, 0, '{}', false,
            '{"show_avatar":true,"show_orders":true,"show_badges":true,"show_spent":true,"show_orders_count":true,"show_registered":true,"hide_profile":false}')
        `;
      } else {
        await sql`
          UPDATE users SET username = ${userDisplayName}, email = ${userData.email}
          WHERE discord_id = ${userId}
        `;
      }
    }

    const token = jwt.sign(userData, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: userData });
  } catch (error) {
    console.error('❌ /api/auth/telegram:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Регистрация Telegram
app.post('/api/register-telegram', authLimiter, async (req, res) => {
  try {
    const { telegramId, username, email } = req.body;
    if (!sql) return res.status(503).json({ success: false, error: 'БД недоступна' });

    const [existingUser] = await sql`SELECT * FROM users WHERE discord_id = ${telegramId}`;
    if (existingUser) {
      return res.json({ success: true, message: 'Пользователь уже существует' });
    }

    await sql`
      INSERT INTO users (discord_id, username, email, balance, badges)
      VALUES (${telegramId}, ${username}, ${email}, 0, '{}')
    `;
    res.json({ success: true, message: 'Пользователь зарегистрирован' });
  } catch (error) {
    console.error('❌ /api/register-telegram:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка регистрации' });
  }
});

// ============================================================
// USER UPDATE
// ============================================================

app.put('/api/user/:userId/email', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const userId = req.params.userId;
    if (decoded.id !== userId) return res.status(403).json({ success: false, error: 'Доступ запрещен' });

    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Неверный формат email' });
    }

    if (sql) {
      await sql`UPDATE users SET email = ${email} WHERE discord_id = ${userId}`;
    }
    res.json({ success: true, message: 'Email успешно обновлён' });
  } catch (error) {
    console.error('❌ PUT /api/user/:userId/email:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.post('/api/user/:userId/avatar', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const userId = req.params.userId;
    if (decoded.id !== userId) return res.status(403).json({ success: false, error: 'Доступ запрещен' });

    const { avatar } = req.body;
    if (sql) {
      await sql`UPDATE users SET avatar = ${avatar} WHERE discord_id = ${userId}`;
    }
    res.json({ success: true, message: 'Аватар успешно обновлён' });
  } catch (error) {
    console.error('❌ POST /api/user/:userId/avatar:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Обновление пользователя (whitelist колонок!)
app.put('/api/user/:userId', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const userId = req.params.userId;
    if (decoded.id !== userId) return res.status(403).json({ success: false, error: 'Доступ запрещен' });

    const { username, email, avatar } = req.body;

    if (sql) {
      if (username !== undefined) {
        await sql`UPDATE users SET username = ${username} WHERE discord_id = ${userId}`;
      }
      if (email !== undefined) {
        await sql`UPDATE users SET email = ${email} WHERE discord_id = ${userId}`;
      }
      if (avatar !== undefined) {
        await sql`UPDATE users SET avatar = ${avatar} WHERE discord_id = ${userId}`;
      }
    }
    res.json({ success: true, message: 'Данные успешно обновлены' });
  } catch (error) {
    console.error('❌ PUT /api/user/:userId:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Refresh Discord
app.post('/api/auth/discord/refresh', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Неверный токен' });

    const userId = decoded.id;

    if (sql) {
      const [user] = await sql`
        SELECT discord_id, username, email, avatar, balance, badges
        FROM users WHERE discord_id = ${userId}
      `;
      if (user) {
        return res.json({
          success: true,
          user: {
            id: user.discord_id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            balance: user.balance,
            badges: user.badges
          }
        });
      }
    }

    res.json({
      success: true,
      user: { id: decoded.id, username: decoded.username, avatar: decoded.avatar, email: decoded.email }
    });
  } catch (error) {
    console.error('❌ /api/auth/discord/refresh:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.post('/api/user/:userId/refresh-avatar', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Неверный токен' });

    const userId = req.params.userId;
    if (decoded.id !== userId) return res.status(403).json({ success: false, error: 'Доступ запрещен' });

    if (sql) {
      const [user] = await sql`SELECT avatar FROM users WHERE discord_id = ${userId}`;
      if (user?.avatar) return res.json({ success: true, avatar: user.avatar });
    }
    res.json({ success: false, error: 'Не удалось обновить аватар' });
  } catch (error) {
    console.error('❌ /api/user/:userId/refresh-avatar:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ============================================================
// ORDERS
// ============================================================

app.post('/api/orders/:orderId/cancel', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const orderId = req.params.orderId;
    const userId = decoded.id;

    let order = null;
    let userOrders = [];
    let userBalance = 0;

    if (sql) {
      const [user] = await sql`SELECT orders, balance FROM users WHERE discord_id = ${userId}`;
      if (user) {
        userOrders = user.orders || [];
        userBalance = user.balance || 0;
        order = userOrders.find(o => o.id === orderId);
      }
    }

    if (!order) return res.status(404).json({ success: false, error: 'Заказ не найден' });
    if (order.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Можно отменить только заказы в статусе "Ожидание"' });
    }

    const refundAmount = order.price || order.finalPrice || 0;
    const newBalance = userBalance + refundAmount;
    const updatedOrders = userOrders.map(o =>
      o.id === orderId ? { ...o, status: 'cancelled', cancelledAt: new Date().toISOString() } : o
    );

    if (sql) {
      await sql`
        UPDATE users
        SET orders = ${JSON.stringify(updatedOrders)}, balance = ${newBalance}
        WHERE discord_id = ${userId}
      `;
    }

    res.json({ success: true, message: 'Заказ успешно отменён', refundAmount, newBalance });
  } catch (error) {
    console.error('❌ /api/orders/:orderId/cancel:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.get('/api/orders/:orderId', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const orderId = req.params.orderId;
    const userId = decoded.id;

    if (sql) {
      const [user] = await sql`SELECT orders FROM users WHERE discord_id = ${userId}`;
      const order = (user?.orders || []).find(o => o.id === orderId);
      if (!order) return res.status(404).json({ success: false, error: 'Заказ не найден' });
      return res.json({ success: true, order });
    }

    res.status(404).json({ success: false, error: 'Заказ не найден' });
  } catch (error) {
    console.error('❌ GET /api/orders/:orderId:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ============================================================
// PRIVACY / FREEZE / DELETE
// ============================================================

app.put('/api/user/:userId/privacy', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const userId = req.params.userId;
    if (decoded.id !== userId) return res.status(403).json({ success: false, error: 'Доступ запрещен' });

    const { privacy } = req.body;

    if (sql) {
      await sql`UPDATE users SET privacy = ${JSON.stringify(privacy)} WHERE discord_id = ${userId}`;
    }
    res.json({ success: true, message: 'Настройки сохранены' });
  } catch (error) {
    console.error('❌ PUT /api/user/:userId/privacy:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.post('/api/user/freeze', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const { userId } = req.body;
    if (decoded.id !== userId) return res.status(403).json({ success: false, error: 'Доступ запрещен' });

    if (sql) {
      await sql`UPDATE users SET frozen = true WHERE discord_id = ${userId}`;
    }
    res.json({ success: true, message: 'Аккаунт заморожен' });
  } catch (error) {
    console.error('❌ /api/user/freeze:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.delete('/api/user/delete', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const { userId } = req.body;
    if (decoded.id !== userId) return res.status(403).json({ success: false, error: 'Доступ запрещен' });

    if (sql) {
      await sql`DELETE FROM messages WHERE user_id = ${userId}`;
      await sql`DELETE FROM reviews WHERE user_id = ${userId}`;
      await sql`DELETE FROM notifications WHERE user_id = ${userId}`;
      await sql`DELETE FROM transactions WHERE user_id = ${userId}`;
      await sql`DELETE FROM users WHERE discord_id = ${userId}`;
    }
    res.json({ success: true, message: 'Аккаунт удалён' });
  } catch (error) {
    console.error('❌ DELETE /api/user/delete:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ============================================================
// ADMIN CHAT
// ============================================================

app.get('/api/admin/chat/users', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });
    if (!sql) return res.json({ success: true, users: [], total: 0 });

    const dbUsers = await sql`SELECT * FROM users ORDER BY registered_at DESC`;
    const unreadMessages = await sql`
      SELECT user_id, COUNT(*) as count
      FROM messages
      WHERE from_admin = false AND read = false
      GROUP BY user_id
    `;

    const unreadMap = {};
    unreadMessages.forEach(row => { unreadMap[row.user_id] = parseInt(row.count); });

    const usersList = dbUsers.map(user => ({
      discordId: user.discord_id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      registeredAt: user.registered_at,
      balance: user.balance || 0,
      orderCount: (user.orders || []).length,
      badges: user.badges || {},
      unreadMessages: unreadMap[user.discord_id] || 0,
      online: false
    }));

    res.json({ success: true, users: usersList, total: usersList.length });
  } catch (error) {
    console.error('❌ /api/admin/chat/users:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ============================================================
// CHAT
// ============================================================

app.get('/api/chat/messages/:userId', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const userId = req.params.userId;
    const isAdmin = await isAdminUserAsync(decoded);
    const isOwner = decoded.id === userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, error: 'Доступ запрещен' });
    }

    if (!sql) return res.json({ success: true, messages: [], total: 0 });

    const messages = await sql`
      SELECT * FROM messages
      WHERE user_id = ${userId}
      ORDER BY timestamp ASC
      LIMIT 100
    `;

    res.json({ success: true, messages: messages || [], total: messages?.length || 0 });
  } catch (error) {
    console.error('❌ GET /api/chat/messages:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.post('/api/chat/send', chatLimiter, async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const { userId, message, fromAdmin } = req.body;
    if (!userId || !message) return res.status(400).json({ success: false, error: 'Не указаны данные' });

    const isAdmin = await isAdminUserAsync(decoded);
    const isOwner = decoded.id === userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, error: 'Доступ запрещен' });
    }

    if (!sql) return res.status(503).json({ success: false, error: 'БД недоступна' });

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    await sql`
      INSERT INTO messages (id, user_id, message, from_admin, read, timestamp)
      VALUES (${messageId}, ${userId}, ${message}, ${fromAdmin || false}, ${!fromAdmin}, ${now})
    `;

    const [user] = await sql`SELECT username FROM users WHERE discord_id = ${userId}`;

    if (!fromAdmin && WEBHOOK_CHAT) {
      try {
        await axios.post(WEBHOOK_CHAT, {
          embeds: [{
            title: '<:TG:1474931529896431838> Новое сообщение от пользователя',
            description: message,
            color: 0x5865F2,
            fields: [
              { name: '<:User:1474931634804359433> Пользователь', value: `<@${userId}>`, inline: true },
              { name: '<:Dot:1474932579328069794> Имя', value: user?.username || 'Неизвестно', inline: true }
            ],
            timestamp: now
          }]
        });
      } catch (webhookError) {
        console.error('⚠️ Ошибка отправки вебхука чата:', webhookError.message);
      }
    }

    res.json({ success: true, messageId });
  } catch (error) {
    console.error('❌ POST /api/chat/send:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка отправки' });
  }
});

app.post('/api/chat/check', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const { userId, lastChecked } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'Не указан userId' });

    const isAdmin = await isAdminUserAsync(decoded);
    const isOwner = decoded.id === userId;
    if (!isAdmin && !isOwner) return res.status(403).json({ success: false, error: 'Доступ запрещен' });
    if (!sql) return res.json({ success: true, hasNew: false, newCount: 0, adminTyping: false });

    const checkTime = lastChecked ? new Date(parseInt(lastChecked)).toISOString() : new Date(0).toISOString();

    const [result] = await sql`
      SELECT COUNT(*) as count FROM messages
      WHERE user_id = ${userId} AND timestamp > ${checkTime}
    `;

    res.json({
      success: true,
      hasNew: parseInt(result?.count || 0) > 0,
      newCount: parseInt(result?.count || 0),
      adminTyping: false
    });
  } catch (error) {
    console.error('❌ POST /api/chat/check:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.post('/api/chat/mark-read/:userId', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const userId = req.params.userId;
    const isAdmin = await isAdminUserAsync(decoded);
    const isOwner = decoded.id === userId;

    if (!isAdmin && !isOwner) return res.status(403).json({ success: false, error: 'Доступ запрещен' });
    if (!sql) return res.json({ success: true });

    await sql`
      UPDATE messages SET read = true
      WHERE user_id = ${userId} AND from_admin = false AND read = false
    `;
    res.json({ success: true });
  } catch (error) {
    console.error('❌ POST /api/chat/mark-read:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.post('/api/chat/admin/mark-read/:userId', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });
    if (!sql) return res.json({ success: true });

    const userId = req.params.userId;
    await sql`
      UPDATE messages SET read = true
      WHERE user_id = ${userId} AND from_admin = false AND read = false
    `;
    res.json({ success: true, message: 'Сообщения отмечены как прочитанные' });
  } catch (error) {
    console.error('❌ POST /api/chat/admin/mark-read:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.get('/api/chat/admin/check', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });
    if (!sql) return res.json({ success: true, unreadCounts: {}, totalUnread: 0 });

    const unreadMessages = await sql`
      SELECT user_id, COUNT(*) as count FROM messages
      WHERE from_admin = false AND read = false
      GROUP BY user_id
    `;

    const unreadCounts = {};
    let totalUnread = 0;
    unreadMessages.forEach(row => {
      unreadCounts[row.user_id] = parseInt(row.count);
      totalUnread += parseInt(row.count);
    });

    res.json({ success: true, unreadCounts, totalUnread });
  } catch (error) {
    console.error('❌ GET /api/chat/admin/check:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.post('/api/chat/typing', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });
    res.json({ success: true });
  } catch (error) {
    console.error('❌ POST /api/chat/typing:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ============================================================
// USER INFO
// ============================================================

app.get('/api/user/me', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Not authorized' });

    if (!sql) {
      return res.json({
        success: true,
        user: {
          discordId: decoded.id,
          username: decoded.username || 'User',
          email: decoded.email || null,
          avatar: decoded.avatar || null,
          registeredAt: new Date().toISOString(),
          balance: 0,
          badges: {},
          orders: [],
          privacy: { show_avatar: true, show_orders: true, show_badges: true, show_spent: true, show_orders_count: true, show_registered: true, hide_profile: false },
          frozen: false
        }
      });
    }

    let user = null;
    try {
      const result = await sql`
        SELECT discord_id, username, email, avatar, registered_at, balance, badges, orders, privacy, frozen
        FROM users WHERE discord_id = ${decoded.id}
      `;
      user = result && result[0];
    } catch (dbError) {
      console.error('❌ /api/user/me DB:', dbError.message);
    }

    if (!user) {
      const username = decoded.username || 'User';
      const email = decoded.email || null;
      const avatar = decoded.avatar || null;

      try {
        await sql`
          INSERT INTO users (discord_id, username, email, avatar, balance, badges, orders, frozen, privacy)
          VALUES (${decoded.id}, ${username}, ${email}, ${avatar}, 0, '{}', '[]', false,
            '{"show_avatar":true,"show_orders":true,"show_badges":true,"show_spent":true,"show_orders_count":true,"show_registered":true,"hide_profile":false}')
        `;
        const result = await sql`
          SELECT discord_id, username, email, avatar, registered_at, balance, badges, orders, privacy, frozen
          FROM users WHERE discord_id = ${decoded.id}
        `;
        user = result && result[0];
      } catch (insertError) {
        console.error('❌ /api/user/me INSERT:', insertError.message);
      }
    }

    if (user) {
      return res.json({
        success: true,
        user: {
          discordId: user.discord_id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          registeredAt: user.registered_at,
          balance: user.balance || 0,
          badges: user.badges || {},
          orders: user.orders || [],
          privacy: user.privacy || {},
          frozen: user.frozen || false
        }
      });
    }

    res.json({
      success: true,
      user: {
        discordId: decoded.id,
        username: decoded.username || 'User',
        email: decoded.email || null,
        avatar: decoded.avatar || null,
        registeredAt: new Date().toISOString(),
        balance: 0,
        badges: {},
        orders: [],
        privacy: { show_avatar: true, show_orders: true, show_badges: true, show_spent: true, show_orders_count: true, show_registered: true, hide_profile: false },
        frozen: false
      }
    });
  } catch (error) {
    console.error('❌ /api/user/me:', error.message);
    res.status(500).json({ success: false, error: 'Server error: ' + error.message });
  }
});

app.get('/api/user/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const decoded = getAuthFromReq(req);
    const isOwner = decoded?.id === userId;

    if (sql) {
      try {
        const [user] = await sql`
          SELECT discord_id, username, email, avatar, registered_at, balance, badges, orders, privacy, frozen
          FROM users WHERE discord_id = ${userId}
        `;

        if (user) {
          const privacy = user.privacy || {
            show_avatar: true, show_orders: true, show_badges: true, show_spent: true,
            show_orders_count: true, show_registered: true, hide_profile: false
          };

          if ((privacy.hide_profile === true || user.frozen === true) && !isOwner) {
            return res.json({
              success: true,
              user: {
                discordId: user.discord_id,
                username: null, email: null, avatar: null, registeredAt: null,
                balance: null, badges: null, orders: null,
                privacy, frozen: user.frozen, hidden: true
              }
            });
          }

          const responseUser = {
            discordId: user.discord_id,
            username: user.username,
            email: isOwner ? (user.email || null) : null,
            registeredAt: user.registered_at,
            balance: isOwner ? (user.balance || 0) : null,
            orders: isOwner ? (user.orders || []) : null,
            badges: isOwner ? (user.badges || {}) : null,
            privacy,
            frozen: user.frozen || false
          };

          if (isOwner || (privacy.show_avatar !== false && user.avatar)) {
            responseUser.avatar = user.avatar;
          } else {
            responseUser.avatar = null;
          }

          if (!isOwner && privacy.show_badges === false) {
            responseUser.badges = null;
          }

          return res.json({ success: true, user: responseUser });
        }
      } catch (dbError) {
        console.error('❌ /api/user/:id DB:', dbError.message);
      }
    }

    const user = users[userId];
    if (!user) return res.json({ success: true, user: null });

    res.json({
      success: true,
      user: {
        discordId: user.discordId,
        username: user.username,
        email: isOwner ? user.email : null,
        avatar: user.avatar,
        registeredAt: user.registeredAt,
        balance: isOwner ? (user.balance || 0) : null,
        badges: isOwner ? (user.badges || {}) : null,
        orders: isOwner ? (user.orders || []).slice(-10) : null
      }
    });
  } catch (error) {
    console.error('❌ GET /api/user/:id:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.post('/api/user/unfreeze', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const { userId } = req.body;
    if (decoded.id !== userId) return res.status(403).json({ success: false, error: 'Доступ запрещен' });

    if (sql) {
      const [user] = await sql`SELECT privacy FROM users WHERE discord_id = ${userId}`;
      const currentPrivacy = user?.privacy || {};

      await sql`
        UPDATE users
        SET frozen = false,
            privacy = ${JSON.stringify({ ...currentPrivacy, hide_profile: false })}
        WHERE discord_id = ${userId}
      `;
    }
    res.json({ success: true, message: 'Аккаунт разморожен' });
  } catch (error) {
    console.error('❌ POST /api/user/unfreeze:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.get('/api/user/:id/balance', async (req, res) => {
  try {
    const userId = req.params.id;
    const decoded = getAuthFromReq(req);
    const isOwner = decoded?.id === userId;

    if (!isOwner) {
      return res.json({ success: true, balance: null, hidden: true, currency: 'RUB' });
    }

    if (sql) {
      const [user] = await sql`SELECT balance FROM users WHERE discord_id = ${userId}`;
      if (user) return res.json({ success: true, balance: user.balance || 0, currency: 'RUB' });
    }

    const user = users[userId];
    res.json({ success: true, balance: user?.balance || 0, currency: 'RUB' });
  } catch (error) {
    console.error('❌ GET /api/user/:id/balance:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.get('/api/user/:id/orders', async (req, res) => {
  try {
    const userId = req.params.id;
    const { status } = req.query;
    const decoded = getAuthFromReq(req);
    const isOwner = decoded?.id === userId;

    if (!isOwner && sql) {
      const [user] = await sql`SELECT privacy, frozen FROM users WHERE discord_id = ${userId}`;
      if (user) {
        const privacy = user.privacy || {};
        if (privacy.hide_profile === true || user.frozen === true || privacy.show_orders === false) {
          return res.json({ success: true, orders: [] });
        }
      }
    }

    let orders = [];

    if (sql) {
      const [user] = await sql`SELECT orders FROM users WHERE discord_id = ${userId}`;
      if (user?.orders) {
        orders = user.orders;
        if (!isOwner) orders = orders.filter(o => o.status === 'completed');
        if (status && status !== 'all') orders = orders.filter(o => o.status === status);
      }
    }

    res.json({ success: true, orders: orders || [] });
  } catch (error) {
    console.error('❌ GET /api/user/:id/orders:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ============================================================
// AUTH DISCORD
// ============================================================

app.post('/api/auth/discord', authLimiter, async (req, res) => {
  try {
    const { code } = req.body;

    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
      return res.status(500).json({ success: false, error: 'Сервер не настроен для Discord авторизации' });
    }
    if (!code) return res.status(400).json({ success: false, error: 'Отсутствует код авторизации' });

    const params = new URLSearchParams();
    params.append('client_id', DISCORD_CLIENT_ID);
    params.append('client_secret', DISCORD_CLIENT_SECRET);
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', DISCORD_REDIRECT_URI);
    params.append('scope', 'identify email');

    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const { access_token, token_type } = tokenResponse.data;

    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `${token_type} ${access_token}` }
    });

    const userData = {
      id: userResponse.data.id,
      username: userResponse.data.username,
      avatar: userResponse.data.avatar,
      email: userResponse.data.email,
      global_name: userResponse.data.global_name || userResponse.data.username
    };

    let userFromDb = null;
    let isNewUser = false;

    if (sql) {
      try {
        const [existingUser] = await sql`SELECT * FROM users WHERE discord_id = ${userData.id}`;
        userFromDb = existingUser;

        if (!existingUser) {
          isNewUser = true;
          await sql`
            INSERT INTO users (discord_id, username, email, avatar, balance, badges, frozen, privacy)
            VALUES (${userData.id}, ${userData.username}, ${userData.email || ''}, ${userData.avatar}, 0,
              ${JSON.stringify({})}, false,
              ${JSON.stringify({ show_avatar: true, show_orders: true, show_badges: true, show_spent: true, show_orders_count: true, show_registered: true, hide_profile: false })})
          `;
        } else {
          const currentPrivacy = existingUser.privacy || {};
          await sql`
            UPDATE users
            SET username = ${userData.username},
                email = ${userData.email || ''},
                avatar = ${userData.avatar},
                frozen = false,
                privacy = ${JSON.stringify({ ...currentPrivacy, hide_profile: false })}
            WHERE discord_id = ${userData.id}
          `;
          const [updatedUser] = await sql`SELECT * FROM users WHERE discord_id = ${userData.id}`;
          userFromDb = updatedUser;
        }
      } catch (dbError) {
        console.error('❌ /api/auth/discord DB:', dbError.message);
      }
    }

    if (!users[userData.id]) {
      users[userData.id] = {
        discordId: userData.id,
        username: userData.username,
        email: userData.email,
        avatar: userData.avatar,
        registeredAt: new Date().toISOString(),
        balance: 0,
        orders: [],
        badges: {}
      };
    }

    const token = jwt.sign(
      { id: userData.id, username: userData.username, email: userData.email, avatar: userData.avatar },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const skipVerification = isNewUser || process.env.SKIP_VERIFICATION === 'true';

    res.json({
      success: true,
      token,
      user: userData,
      skipVerification,
      isNewUser,
      userFromDb: userFromDb ? {
        id: userFromDb.discord_id,
        balance: userFromDb.balance || 0,
        badges: userFromDb.badges || {}
      } : null
    });
  } catch (error) {
    console.error('❌ /api/auth/discord:', error.message);
    if (error.response) console.error('- Data:', error.response.data);

    res.status(500).json({
      success: false,
      error: 'Ошибка авторизации через Discord',
      details: error.response?.data || error.message
    });
  }
});

app.get('/auth/discord/callback', (req, res) => {
  const { code, state } = req.query;

  const html = `<!DOCTYPE html>
<html>
<head>
<title>Авторизация BHStore</title>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body{background:linear-gradient(135deg,#1e1f29 0%,#14151a 100%);color:#fff;font-family:'Segoe UI',sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;padding:20px}
.container{text-align:center;padding:40px;background:#2a2b36;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.4);max-width:500px;width:100%}
.loader{border:5px solid rgba(255,255,255,.1);border-top:5px solid #5865F2;border-radius:50%;width:60px;height:60px;animation:spin 1s linear infinite;margin:0 auto 20px}
@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
h2{margin-bottom:10px;color:#5865F2}
p{color:#b9bbbe;margin-bottom:20px}
.success{color:#57F287;font-weight:bold}
</style>
<script>
window.onload = function() {
  const code = '${escapeHtml(String(code || ''))}';
  const state = '${escapeHtml(String(state || ''))}';
  if (!code) { document.getElementById('status').textContent = 'Ошибка: код не получен'; return; }
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage({ type: 'DISCORD_AUTH_CALLBACK', code, state }, '*');
      document.getElementById('status').className = 'success';
      document.getElementById('status').textContent = 'Авторизация успешна!';
      document.getElementById('message').textContent = 'Закрываю окно...';
      setTimeout(function() { window.close(); }, 1000);
    } catch (error) {
      document.getElementById('status').textContent = 'Ошибка отправки данных';
    }
  } else {
    document.getElementById('status').textContent = 'Ошибка: окно авторизации закрыто';
  }
};
</script>
</head>
<body>
<div class="container">
<div class="loader"></div>
<h2 id="status">Обработка авторизации...</h2>
<p id="message">Пожалуйста, подождите</p>
</div>
</body>
</html>`;

  res.send(html);
});

// ============================================================
// VERIFICATION
// ============================================================

app.post('/api/send-verification', authLimiter, async (req, res) => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      return res.status(400).json({ success: false, error: 'Не указаны userId или code' });
    }

    let sent = false;
    const methods = [];

    // Discord webhook
    if (WEBHOOK_VERIFY) {
      try {
        await axios.post(WEBHOOK_VERIFY, {
          content: `<@${userId}>`,
          embeds: [{
            title: '🔐 Верификация BHStore',
            description: `Ваш код верификации: \`${code}\``,
            color: 0x5865F2,
            fields: [
              { name: '⏰ Действителен', value: '5 минут', inline: true },
              { name: '⚠️ Важно', value: 'Никому не сообщайте код!', inline: true }
            ],
            timestamp: new Date().toISOString()
          }]
        });
        sent = true;
        methods.push('discord_webhook');
      } catch (discordError) {
        console.log('❌ Discord webhook:', discordError.message);
      }
    }

    // Telegram fallback
    if (!sent && TELEGRAM_BOT_TOKEN) {
      try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          chat_id: userId,
          text: `🔐 **КОД ВЕРИФИКАЦИИ BHStore**\n\nЗдравствуйте!\n\nВаш код: \`${code}\`\n\n⏰ Код действителен 5 минут.\n⚠️ Никому не сообщайте код!`,
          parse_mode: 'Markdown'
        });
        sent = true;
        methods.push('telegram_bot');
      } catch (telegramError) {
        console.log('❌ Telegram bot:', telegramError.message);
      }
    }

    if (!sent) {
      console.warn('⚠️ Не удалось отправить код');
      return res.json({ success: false, error: 'Не удалось отправить код. Попробуйте позже.', code, fallback: true });
    }

    res.json({ success: true, message: 'Код отправлен', methods });
  } catch (error) {
    console.error('❌ /api/send-verification:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера: ' + error.message });
  }
});

// ============================================================
// REGISTER
// ============================================================

app.post('/api/register', authLimiter, async (req, res) => {
  try {
    const { discordId, username, email, avatar } = req.body;

    if (!discordId || !username) {
      return res.status(400).json({ success: false, error: 'Не указаны обязательные поля' });
    }

    if (sql) {
      const [existingUser] = await sql`SELECT * FROM users WHERE discord_id = ${discordId}`;
      if (existingUser) {
        return res.json({ success: true, message: 'Пользователь уже зарегистрирован', alreadyExists: true });
      }

      await sql`
        INSERT INTO users (discord_id, username, email, avatar, balance, badges, frozen, privacy)
        VALUES (${discordId}, ${username}, ${email || ''}, ${avatar || null}, 0, ${JSON.stringify({})}, false,
          ${JSON.stringify({ show_avatar: true, show_orders: true, show_badges: true, show_spent: true, show_orders_count: true, show_registered: true, hide_profile: false })})
      `;
    }

    if (!users[discordId]) {
      users[discordId] = {
        discordId, username, email: email || '', avatar: avatar || null,
        registeredAt: new Date().toISOString(), balance: 0, orders: [], badges: {}
      };
    }

    res.json({ success: true, message: 'Пользователь зарегистрирован' });
  } catch (error) {
    console.error('❌ /api/register:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка регистрации: ' + error.message });
  }
});

// ============================================================
// WELCOME
// ============================================================

app.post('/api/welcome-message', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!WEBHOOK_WELCOME) return res.json({ success: false });

    await axios.post(WEBHOOK_WELCOME, {
      content: `<@${userId}>`,
      embeds: [{
        title: '<:Wave:1386273780556496967> Добро пожаловать в BHStore!',
        description: 'Вы успешно зарегистрировались в нашем магазине!',
        color: 0x57F287,
        fields: [
          { name: '🎉 Что дальше?', value: '1. Пополните баланс\n2. Выберите товары в магазине\n3. Наслаждайтесь покупками!', inline: false },
          { name: '🔗 Полезные ссылки', value: `[Магазин](${PUBLIC_URL}/shop.html) | [Профиль](${PUBLIC_URL}/profile.html) | [Поддержка](${PUBLIC_URL}/profile.html#supportChat)`, inline: false }
        ],
        timestamp: new Date().toISOString()
      }]
    });

    res.json({ success: true });
  } catch (error) {
    console.error('❌ /api/welcome-message:', error.message);
    res.json({ success: false });
  }
});

// ============================================================
// CREATE ORDER
// ============================================================

app.post('/api/create-order', async (req, res) => {
  try {
    const {
      userId, productId, productName, price, originalPrice, username,
      promocodes: usedPromocodes, discount, discountAmount, orderId: clientOrderId
    } = req.body;

    if (!userId || !productName || price === undefined) {
      return res.status(400).json({ success: false, error: 'Не указаны обязательные поля' });
    }

    const orderId = clientOrderId || `BH-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    let user = null;
    let userBalance = 0;

    if (sql) {
      try {
        const [dbUser] = await sql`SELECT * FROM users WHERE discord_id = ${userId}`;
        user = dbUser;
        if (user) userBalance = user.balance || 0;
      } catch (dbError) {
        console.error('❌ create-order DB:', dbError.message);
      }
    }

    if (!user) {
      user = users[userId];
      userBalance = user?.balance || 0;
    }

    if (!user) return res.status(404).json({ success: false, error: 'Пользователь не найден' });

    const finalPrice = price;
    if (userBalance < finalPrice) {
      return res.status(400).json({ success: false, error: 'Недостаточно средств на балансе' });
    }

    const newBalance = userBalance - finalPrice;

    const order = {
      id: orderId,
      productId,
      productName,
      price: finalPrice,
      originalPrice: originalPrice || price,
      discount: discount || 0,
      discountAmount: discountAmount || 0,
      promocodes: usedPromocodes || [],
      date: new Date().toISOString(),
      status: 'completed'
    };

    if (users[userId]) {
      users[userId].balance = newBalance;
      users[userId].orders = users[userId].orders || [];
      users[userId].orders.push(order);
      users[userId].badges = users[userId].badges || {};
      users[userId].badges.buyer = true;
    }

    if (sql) {
      try {
        const orders = user.orders || [];
        orders.push(order);
        const badges = user.badges || {};
        badges.buyer = true;

        await sql`
          UPDATE users
          SET balance = ${newBalance}, orders = ${JSON.stringify(orders)}, badges = ${JSON.stringify(badges)}
          WHERE discord_id = ${userId}
        `;
      } catch (dbError) {
        console.error('❌ create-order UPDATE:', dbError.message);
      }
    }

    // Webhook
    if (WEBHOOK_PURCHASE) {
      try {
        const embed = {
          title: '<:Price:1474932616523415583> Новая покупка!',
          description: `<:User:1474931634804359433> <@${userId}> купил "${productName}"`,
          color: 0x57F287,
          fields: [
            { name: '<:Dot:1474932579328069794> Цена', value: `${finalPrice} ₽`, inline: true },
            { name: '<:Dot:1474932579328069794> Заказ', value: orderId, inline: true },
            { name: '<:Dot:1474932579328069794> Баланс после', value: `${newBalance} ₽`, inline: true }
          ],
          timestamp: new Date().toISOString()
        };

        if (discount && discount > 0) embed.fields.unshift({ name: '🏷️ Скидка', value: `${discount}%`, inline: true });
        if (usedPromocodes && usedPromocodes.length > 0) embed.fields.unshift({ name: '🎫 Промокоды', value: usedPromocodes.join(', '), inline: true });

        await axios.post(WEBHOOK_PURCHASE, { embeds: [embed] });
      } catch (webhookError) {
        console.error('⚠️ create-order webhook:', webhookError.message);
      }
    }

    res.json({ success: true, orderId, newBalance });
  } catch (error) {
    console.error('❌ /api/create-order:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка создания заказа' });
  }
});

// ============================================================
// NEWS
// ============================================================

app.get('/api/news', async (req, res) => {
  try {
    if (!sql) {
      return res.json({ success: true, news: demoNews, total: demoNews.length, source: 'memory' });
    }

    const news = await sql`SELECT * FROM news ORDER BY created_at DESC LIMIT 50`;

    const formattedNews = news.map(item => ({
      id: item.id,
      title: item.title,
      content: item.content,
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : new Date(item.created_at).toISOString().split('T')[0],
      category: item.category || 'announcement',
      views: item.views || 0,
      author: item.author || 'BHStore',
      tags: item.tags || [],
      image: item.image || null,
      created_at: item.created_at
    }));

    res.json({ success: true, news: formattedNews, total: formattedNews.length, source: 'database' });
  } catch (error) {
    console.error('❌ GET /api/news:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка загрузки новостей: ' + error.message, news: [], total: 0 });
  }
});

app.get('/api/news/:id', async (req, res) => {
  try {
    const newsId = parseInt(req.params.id);
    if (isNaN(newsId)) return res.status(400).json({ success: false, error: 'Неверный ID новости' });
    if (!sql) return res.status(503).json({ success: false, error: 'База данных недоступна' });

    const [newsItem] = await sql`SELECT * FROM news WHERE id = ${newsId}`;
    if (!newsItem) return res.status(404).json({ success: false, error: 'Новость не найдена' });

    await sql`UPDATE news SET views = views + 1 WHERE id = ${newsId}`;

    res.json({
      success: true,
      news: {
        id: newsItem.id,
        title: newsItem.title,
        content: newsItem.content,
        date: newsItem.date ? new Date(newsItem.date).toISOString().split('T')[0] : new Date(newsItem.created_at).toISOString().split('T')[0],
        category: newsItem.category || 'announcement',
        views: (newsItem.views || 0) + 1,
        author: newsItem.author || 'BHStore',
        tags: newsItem.tags || [],
        image: newsItem.image || null,
        created_at: newsItem.created_at
      }
    });
  } catch (error) {
    console.error('❌ GET /api/news/:id:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка загрузки новости: ' + error.message });
  }
});

// ============================================================
// ADMIN: ORDERS
// ============================================================

app.post('/api/admin/orders/manual', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });

    const { userId, productName, amount, status, orderId } = req.body;
    if (!userId || !productName || !amount) {
      return res.status(400).json({ success: false, error: 'Не все данные заполнены' });
    }

    const newOrder = {
      id: orderId || `BH-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      productId: `manual_${Date.now()}`,
      productName,
      price: amount,
      finalPrice: amount,
      originalPrice: amount,
      amount,
      status: status || 'completed',
      date: new Date().toISOString(),
      isManual: true,
      createdAt: new Date().toISOString()
    };

    if (!sql) {
      if (!users[userId]) users[userId] = { discordId: userId, orders: [], balance: 0 };
      users[userId].orders = users[userId].orders || [];
      users[userId].orders.push(newOrder);
      return res.json({ success: true, message: 'Заказ создан (in-memory)', order: newOrder });
    }

    const [user] = await sql`SELECT * FROM users WHERE discord_id = ${userId}`;
    if (!user) return res.status(404).json({ success: false, error: 'Пользователь не найден' });

    const orders = user.orders || [];
    orders.push(newOrder);

    await sql`UPDATE users SET orders = ${JSON.stringify(orders)} WHERE discord_id = ${userId}`;

    res.json({ success: true, message: 'Заказ создан', order: newOrder });
  } catch (error) {
    console.error('❌ /api/admin/orders/manual:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.delete('/api/admin/orders/:orderId', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });

    const orderId = req.params.orderId;

    if (!sql) {
      let found = false;
      for (const user of Object.values(users)) {
        const orders = user.orders || [];
        const idx = orders.findIndex(o => o.id === orderId);
        if (idx !== -1) { orders.splice(idx, 1); found = true; break; }
      }
      if (!found) return res.status(404).json({ success: false, error: 'Заказ не найден' });
      return res.json({ success: true, message: 'Заказ удалён (in-memory)' });
    }

    const usersList = await sql`SELECT * FROM users`;
    let found = false;

    for (const user of usersList) {
      const orders = user.orders || [];
      const idx = orders.findIndex(o => o.id === orderId);
      if (idx !== -1) {
        orders.splice(idx, 1);
        await sql`UPDATE users SET orders = ${JSON.stringify(orders)} WHERE discord_id = ${user.discord_id}`;
        found = true;
        break;
      }
    }

    if (!found) return res.status(404).json({ success: false, error: 'Заказ не найден' });
    res.json({ success: true, message: 'Заказ удалён' });
  } catch (error) {
    console.error('❌ DELETE /api/admin/orders/:orderId:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.put('/api/admin/orders/:orderId', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });

    const orderId = req.params.orderId;
    const { productName, finalPrice, status, date } = req.body;

    if (!sql) {
      let found = false;
      for (const user of Object.values(users)) {
        const orders = user.orders || [];
        const idx = orders.findIndex(o => o.id === orderId);
        if (idx !== -1) {
          if (productName) orders[idx].productName = productName;
          if (finalPrice) { orders[idx].price = finalPrice; orders[idx].finalPrice = finalPrice; }
          if (status) orders[idx].status = status;
          if (date) orders[idx].date = date;
          orders[idx].updatedAt = new Date().toISOString();
          found = true;
          break;
        }
      }
      if (!found) return res.status(404).json({ success: false, error: 'Заказ не найден' });
      return res.json({ success: true, message: 'Заказ обновлён (in-memory)' });
    }

    const usersList = await sql`SELECT * FROM users`;
    let found = false;

    for (const user of usersList) {
      const orders = user.orders || [];
      const idx = orders.findIndex(o => o.id === orderId);
      if (idx !== -1) {
        if (productName) orders[idx].productName = productName;
        if (finalPrice) { orders[idx].price = finalPrice; orders[idx].finalPrice = finalPrice; }
        if (status) orders[idx].status = status;
        if (date) orders[idx].date = date;
        orders[idx].updatedAt = new Date().toISOString();

        await sql`UPDATE users SET orders = ${JSON.stringify(orders)} WHERE discord_id = ${user.discord_id}`;
        found = true;
        break;
      }
    }

    if (!found) return res.status(404).json({ success: false, error: 'Заказ не найден' });
    res.json({ success: true, message: 'Заказ обновлён' });
  } catch (error) {
    console.error('❌ PUT /api/admin/orders/:orderId:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.get('/api/admin/orders', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });

    if (!sql) return res.json({ success: true, orders: [], total: 0 });

    const usersList = await sql`SELECT discord_id, username, avatar, orders FROM users`;
    const allOrders = [];

    for (const user of usersList) {
      const orders = user.orders || [];
      for (const order of orders) {
        allOrders.push({
          id: order.id,
          userId: user.discord_id,
          username: user.username || 'Неизвестно',
          userDiscordId: user.discord_id,
          userAvatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.png` : null,
          productName: order.productName,
          productId: order.productId,
          amount: order.price || order.finalPrice,
          finalPrice: order.price || order.finalPrice,
          originalPrice: order.originalPrice || order.price,
          discount: order.discount || 0,
          date: order.date || new Date().toISOString(),
          status: order.status || 'completed',
          createdAt: order.date || new Date().toISOString()
        });
      }
    }

    allOrders.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Пагинация (опционально)
    const { page, limit } = req.query;
    if (page && limit) {
      const p = parseInt(page) || 1;
      const l = Math.min(parseInt(limit) || 50, 200);
      const total = allOrders.length;
      const sliced = allOrders.slice((p - 1) * l, (p - 1) * l + l);
      return res.json({ success: true, orders: sliced, total, page: p, limit: l, totalPages: Math.ceil(total / l) });
    }

    res.json({ success: true, orders: allOrders, total: allOrders.length });
  } catch (error) {
    console.error('❌ GET /api/admin/orders:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера: ' + error.message });
  }
});

// Legacy endpoint (сохранён для совместимости)
app.post('/api/admin-update-order', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });

    const { orderId, status } = req.body;
    if (!orderId || !status) return res.status(400).json({ success: false, error: 'Не указаны orderId или status' });

    // Реально обновляем
    if (sql) {
      const usersList = await sql`SELECT * FROM users`;
      for (const user of usersList) {
        const orders = user.orders || [];
        const idx = orders.findIndex(o => o.id === orderId);
        if (idx !== -1) {
          orders[idx].status = status;
          orders[idx].updatedAt = new Date().toISOString();
          await sql`UPDATE users SET orders = ${JSON.stringify(orders)} WHERE discord_id = ${user.discord_id}`;
          return res.json({ success: true, message: 'Статус заказа обновлён' });
        }
      }
      return res.status(404).json({ success: false, error: 'Заказ не найден' });
    }

    res.json({ success: true, message: 'Статус заказа обновлён (in-memory)' });
  } catch (error) {
    console.error('❌ /api/admin-update-order:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ============================================================
// ADMIN: USERS
// ============================================================

app.delete('/api/admin/users/:userId', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });

    const userId = req.params.userId;

    if (sql) {
      await sql`DELETE FROM messages WHERE user_id = ${userId}`;
      await sql`DELETE FROM reviews WHERE user_id = ${userId}`;
      await sql`DELETE FROM notifications WHERE user_id = ${userId}`;
      await sql`DELETE FROM transactions WHERE user_id = ${userId}`;
      await sql`DELETE FROM users WHERE discord_id = ${userId}`;
    }

    res.json({ success: true, message: 'Пользователь удалён' });
  } catch (error) {
    console.error('❌ DELETE /api/admin/users/:userId:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// UPDATE user (whitelist колонок!)
app.put('/api/admin/users/:userId', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });

    const userId = req.params.userId;
    const { username, email, balance, badges, avatar } = req.body;

    const updates = {};
    if (username !== undefined) updates.username = username;
    if (email !== undefined) updates.email = email;
    if (balance !== undefined) updates.balance = balance;
    if (avatar !== undefined) updates.avatar = avatar;
    if (badges !== undefined) updates.badges = JSON.stringify(badges);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'Нет данных для обновления' });
    }

    if (sql) {
      // Только whitelisted колонки
      const safeKeys = Object.keys(updates).filter(k => USER_UPDATE_WHITELIST.includes(k));

      for (const key of safeKeys) {
        const value = updates[key];
        // По одному UPDATE — безопаснее чем динамический SET
        if (key === 'username') await sql`UPDATE users SET username = ${value} WHERE discord_id = ${userId}`;
        else if (key === 'email') await sql`UPDATE users SET email = ${value} WHERE discord_id = ${userId}`;
        else if (key === 'balance') await sql`UPDATE users SET balance = ${value} WHERE discord_id = ${userId}`;
        else if (key === 'avatar') await sql`UPDATE users SET avatar = ${value} WHERE discord_id = ${userId}`;
        else if (key === 'badges') await sql`UPDATE users SET badges = ${value} WHERE discord_id = ${userId}`;
      }
    }

    res.json({ success: true, message: 'Пользователь обновлён' });
  } catch (error) {
    console.error('❌ PUT /api/admin/users/:userId:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.post('/api/admin/users/:userId/badges', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });

    const userId = req.params.userId;
    const { badgeKey, value } = req.body;

    if (!sql) return res.status(503).json({ success: false, error: 'БД недоступна' });

    const [user] = await sql`SELECT badges FROM users WHERE discord_id = ${userId}`;
    if (!user) return res.status(404).json({ success: false, error: 'Пользователь не найден' });

    const badges = user.badges || {};
    badges[badgeKey] = value;

    await sql`UPDATE users SET badges = ${JSON.stringify(badges)} WHERE discord_id = ${userId}`;

    res.json({ success: true, message: 'Бейдж обновлён', badges });
  } catch (error) {
    console.error('❌ POST /api/admin/users/:userId/badges:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });

    if (!sql) return res.json({ success: true, users: [], total: 0 });

    const dbUsers = await sql`SELECT * FROM users ORDER BY registered_at DESC`;

    const allUsers = dbUsers.map(user => ({
      discordId: user.discord_id,
      username: user.username || 'Без имени',
      email: user.email || '',
      avatar: user.avatar,
      registeredAt: user.registered_at,
      balance: user.balance || 0,
      orderCount: (user.orders || []).length,
      badges: user.badges || {}
    }));

    res.json({ success: true, users: allUsers, total: allUsers.length });
  } catch (error) {
    console.error('❌ GET /api/admin/users:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.get('/api/admin/check', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.json({ isAdmin: false });

    if (decoded.id === HARDCODED_ADMIN_ID) return res.json({ isAdmin: true });

    if (sql) {
      const [user] = await sql`SELECT badges FROM users WHERE discord_id = ${decoded.id}`;
      if (user?.badges?.admin) return res.json({ isAdmin: true });
    }

    res.json({ isAdmin: false });
  } catch (error) {
    console.error('❌ /api/admin/check:', error.message);
    res.json({ isAdmin: false });
  }
});

app.get('/api/admin/stats', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });

    if (!sql) return res.json({ success: true, stats: { totalUsers: 0, newUsers: 0, totalOrders: 0, newOrders: 0, revenue: 0, conversion: 0, avgOrderValue: 0 } });

    const [userStats] = await sql`
      SELECT
        COUNT(*) as total_users,
        SUM(CASE WHEN registered_at > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) as new_users
      FROM users
    `;

    const usersList = await sql`SELECT orders FROM users`;

    let totalOrders = 0;
    let totalRevenue = 0;
    let newOrders = 0;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    usersList.forEach(user => {
      const orders = user.orders || [];
      totalOrders += orders.length;
      orders.forEach(order => {
        totalRevenue += order.price || 0;
        if (new Date(order.date) > weekAgo) newOrders++;
      });
    });

    const conversion = userStats.total_users > 0 ? Math.round((totalOrders / userStats.total_users) * 100) : 0;

    res.json({
      success: true,
      stats: {
        totalUsers: parseInt(userStats.total_users) || 0,
        newUsers: parseInt(userStats.new_users) || 0,
        totalOrders,
        newOrders,
        revenue: totalRevenue,
        conversion,
        avgOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0
      }
    });
  } catch (error) {
    console.error('❌ /api/admin/stats:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ============================================================
// ADMIN: NEWS
// ============================================================

app.post('/api/admin/news', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });

    const { title, content, category, date, tags, image } = req.body;
    if (!title || !content) return res.status(400).json({ success: false, error: 'Не указаны обязательные поля' });

    if (sql) {
      const result = await sql`
        INSERT INTO news (title, content, date, category, tags, image, author, created_at, updated_at)
        VALUES (${title}, ${content},
          ${date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]},
          ${category || 'announcement'}, ${JSON.stringify(tags || [])}, ${image || null},
          ${decoded.username || 'Администратор'}, NOW(), NOW())
        RETURNING id
      `;

      if (WEBHOOK_NEWS) {
        try {
          const categoryNames = { announcement: '📢 Объявление', updates: '🚀 Обновление', events: '🎉 Событие', promo: '🎁 Акция' };
          await axios.post(WEBHOOK_NEWS, {
            embeds: [{
              title: '<:Wave:1386273780556496967> Новая новость!',
              description: `**${title}**`,
              color: 0x57F287,
              fields: [
                { name: '📋 Категория', value: categoryNames[category] || category || 'Объявление', inline: true },
                { name: '👤 Автор', value: decoded.username || 'Администратор', inline: true },
                { name: '📝 Содержание', value: content.substring(0, 200) + (content.length > 200 ? '...' : ''), inline: false }
              ],
              timestamp: new Date().toISOString()
            }]
          });
        } catch (webhookError) {
          console.error('⚠️ News webhook:', webhookError.message);
        }
      }

      return res.json({ success: true, message: 'Новость создана', id: result[0].id });
    }

    // Fallback
    const newId = Date.now();
    demoNews.unshift({
      id: newId, title, content,
      date: date || new Date().toISOString().split('T')[0],
      category: category || 'announcement', views: 0,
      author: decoded.username || 'Администратор',
      tags: tags || [], image: image || null,
      created_at: new Date().toISOString()
    });
    res.json({ success: true, message: 'Новость создана (демо-режим)', id: newId });
  } catch (error) {
    console.error('❌ POST /api/admin/news:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера: ' + error.message });
  }
});

app.put('/api/admin/news/:id', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });

    const newsId = parseInt(req.params.id);
    const { title, content, category, date, tags, image } = req.body;
    if (!title || !content) return res.status(400).json({ success: false, error: 'Не указаны обязательные поля' });

    if (sql) {
      await sql`
        UPDATE news
        SET title = ${title}, content = ${content},
            date = ${date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]},
            category = ${category || 'announcement'},
            tags = ${JSON.stringify(tags || [])}, image = ${image || null},
            updated_at = NOW()
        WHERE id = ${newsId}
      `;
    }

    res.json({ success: true, message: 'Новость обновлена' });
  } catch (error) {
    console.error('❌ PUT /api/admin/news/:id:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.delete('/api/admin/news/:id', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });

    const newsId = parseInt(req.params.id);

    if (sql) {
      await sql`DELETE FROM news WHERE id = ${newsId}`;
    }

    res.json({ success: true, message: 'Новость удалена' });
  } catch (error) {
    console.error('❌ DELETE /api/admin/news/:id:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.get('/api/admin/news', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });

    let news = [];

    if (sql) {
      news = await sql`SELECT * FROM news ORDER BY created_at DESC`;
    } else {
      news = demoNews;
    }

    res.json({ success: true, news, total: news.length });
  } catch (error) {
    console.error('❌ GET /api/admin/news:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ============================================================
// ADMIN: BALANCE
// ============================================================

app.post('/api/admin/balance/add', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });

    const { userId, amount, reason } = req.body;
    if (!userId || !amount) return res.status(400).json({ success: false, error: 'Не указаны userId или amount' });

    if (!sql) return res.status(503).json({ success: false, error: 'БД недоступна' });

    const [user] = await sql`SELECT * FROM users WHERE discord_id = ${userId}`;
    if (!user) return res.status(404).json({ success: false, error: 'Пользователь не найден' });

    const newBalance = (user.balance || 0) + parseInt(amount);

    await sql`UPDATE users SET balance = ${newBalance} WHERE discord_id = ${userId}`;

    // Транзакция
    const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await sql`
      INSERT INTO transactions (id, user_id, amount, type, reason, admin_id, admin_name, created_at)
      VALUES (${txId}, ${userId}, ${parseInt(amount)}, 'deposit', ${reason || 'Пополнение администратором'}, ${decoded.id}, ${decoded.username || 'Admin'}, NOW())
    `;

    res.json({ success: true, message: `Баланс пополнен на ${amount} ₽`, newBalance });
  } catch (error) {
    console.error('❌ /api/admin/balance/add:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.post('/api/admin/balance/remove', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });

    const { userId, amount, reason } = req.body;
    if (!userId || !amount) return res.status(400).json({ success: false, error: 'Не указаны userId или amount' });

    if (!sql) return res.status(503).json({ success: false, error: 'БД недоступна' });

    const [user] = await sql`SELECT * FROM users WHERE discord_id = ${userId}`;
    if (!user) return res.status(404).json({ success: false, error: 'Пользователь не найден' });

    const currentBalance = user.balance || 0;
    const removeAmount = parseInt(amount);

    if (currentBalance < removeAmount) {
      return res.status(400).json({ success: false, error: 'Недостаточно средств на балансе' });
    }

    const newBalance = currentBalance - removeAmount;

    await sql`UPDATE users SET balance = ${newBalance} WHERE discord_id = ${userId}`;

    const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await sql`
      INSERT INTO transactions (id, user_id, amount, type, reason, admin_id, admin_name, created_at)
      VALUES (${txId}, ${userId}, ${removeAmount}, 'withdrawal', ${reason || 'Списание администратором'}, ${decoded.id}, ${decoded.username || 'Admin'}, NOW())
    `;

    res.json({ success: true, message: `Списано ${removeAmount} ₽ с баланса`, newBalance });
  } catch (error) {
    console.error('❌ /api/admin/balance/remove:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.post('/api/admin/balance/set', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });

    const { userId, newBalance, reason } = req.body;
    if (!userId || newBalance === undefined) return res.status(400).json({ success: false, error: 'Не указаны userId или newBalance' });

    if (!sql) return res.status(503).json({ success: false, error: 'БД недоступна' });

    const newBalanceValue = parseInt(newBalance);
    if (newBalanceValue < 0) return res.status(400).json({ success: false, error: 'Баланс не может быть отрицательным' });

    await sql`UPDATE users SET balance = ${newBalanceValue} WHERE discord_id = ${userId}`;

    res.json({ success: true, message: `Баланс установлен на ${newBalanceValue} ₽`, newBalance: newBalanceValue });
  } catch (error) {
    console.error('❌ /api/admin/balance/set:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.get('/api/admin/balance-history/:userId', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });

    const userId = req.params.userId;

    if (!sql) return res.json({ success: true, transactions: [], totalDeposits: 0, totalWithdrawals: 0 });

    const transactions = await sql`
      SELECT * FROM transactions
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 100
    `;

    let totalDeposits = 0;
    let totalWithdrawals = 0;
    transactions.forEach(t => {
      if (t.type === 'deposit') totalDeposits += t.amount;
      if (t.type === 'withdrawal') totalWithdrawals += t.amount;
    });

    res.json({ success: true, transactions, totalDeposits, totalWithdrawals });
  } catch (error) {
    console.error('❌ /api/admin/balance-history:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ============================================================
// ADMIN: PRODUCTS
// ============================================================

app.post('/api/admin/products', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });

    const productData = req.body;
    if (!productData.name || !productData.price) {
      return res.status(400).json({ success: false, error: 'Не указаны обязательные поля' });
    }

    if (!productData.id) productData.id = 'prod_' + Date.now();

    if (sql) {
      await sql`
        INSERT INTO products (id, name, description, price, category, icon, image, features, popular, discount)
        VALUES (${productData.id}, ${productData.name}, ${productData.description || ''}, ${productData.price},
          ${productData.category || 'other'}, ${productData.icon || 'fas fa-box'}, ${productData.image || ''},
          ${JSON.stringify(productData.features || [])}, ${productData.popular || false}, ${productData.discount || 0})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, description = EXCLUDED.description, price = EXCLUDED.price,
          category = EXCLUDED.category, icon = EXCLUDED.icon, image = EXCLUDED.image,
          features = EXCLUDED.features, popular = EXCLUDED.popular, discount = EXCLUDED.discount
      `;
    }

    res.json({ success: true, message: 'Товар создан', product: productData });
  } catch (error) {
    console.error('❌ POST /api/admin/products:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.get('/api/admin/products/:id', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });

    const productId = req.params.id;

    if (!sql) return res.status(503).json({ success: false, error: 'БД недоступна' });

    const [product] = await sql`SELECT * FROM products WHERE id = ${productId}`;
    if (!product) return res.status(404).json({ success: false, error: 'Товар не найден' });

    res.json({ success: true, product });
  } catch (error) {
    console.error('❌ GET /api/admin/products/:id:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.put('/api/admin/products/:id', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });

    const productId = req.params.id;
    const productData = req.body;

    if (sql) {
      await sql`
        UPDATE products
        SET name = ${productData.name}, description = ${productData.description || ''},
            price = ${productData.price}, category = ${productData.category || 'other'},
            icon = ${productData.icon || 'fas fa-box'}, image = ${productData.image || ''},
            features = ${JSON.stringify(productData.features || [])},
            popular = ${productData.popular || false}, discount = ${productData.discount || 0}
        WHERE id = ${productId}
      `;
    }

    res.json({ success: true, message: 'Товар обновлен' });
  } catch (error) {
    console.error('❌ PUT /api/admin/products/:id:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.delete('/api/admin/products/:id', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });

    const productId = req.params.id;

    if (sql) {
      await sql`DELETE FROM products WHERE id = ${productId}`;
    }

    res.json({ success: true, message: 'Товар удален' });
  } catch (error) {
    console.error('❌ DELETE /api/admin/products/:id:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ============================================================
// PROMOCODES
// ============================================================

app.post('/api/promocodes/check', async (req, res) => {
  try {
    const { userId, code } = req.body;
    if (!userId || !code) return res.status(400).json({ success: false, error: 'Не указаны userId или code' });

    const codeUpper = code.toUpperCase();
    const now = new Date();

    let promocode = null;
    if (sql) {
      const [result] = await sql`SELECT * FROM promocodes WHERE UPPER(code) = ${codeUpper}`;
      promocode = result;
    }

    if (!promocode) return res.status(404).json({ success: false, error: '🔍 Промокод не найден' });
    if (!promocode.active) return res.status(400).json({ success: false, error: '❌ Промокод неактивен' });

    if (promocode.max_uses && promocode.used_count >= promocode.max_uses) {
      return res.status(400).json({ success: false, error: `❌ Промокод больше недействителен (${promocode.used_count}/${promocode.max_uses})`, reason: 'expired' });
    }

    const usedBy = promocode.used_by || [];
    const userUseCount = usedBy.filter(id => id === userId).length;
    const maxPerUser = promocode.max_uses_per_user || 1;

    if (userUseCount >= maxPerUser) {
      return res.status(400).json({ success: false, error: `⚠️ Вы уже использовали этот промокод ${userUseCount} раз(а). Максимум: ${maxPerUser}`, reason: 'already_used' });
    }

    if (promocode.valid_from) {
      const validFrom = new Date(promocode.valid_from);
      if (now < validFrom) {
        return res.status(400).json({ success: false, error: `📅 Промокод начнет действовать с ${validFrom.toLocaleDateString('ru-RU')}`, reason: 'not_started' });
      }
    }

    if (promocode.valid_until) {
      const validUntil = new Date(promocode.valid_until);
      if (now > validUntil) {
        return res.status(400).json({ success: false, error: `⏰ Промокод истек ${validUntil.toLocaleDateString('ru-RU')}`, reason: 'expired' });
      }
    }

    res.json({
      success: true,
      promocode: {
        code: promocode.code,
        type: promocode.type,
        value: promocode.value,
        max_uses: promocode.max_uses,
        max_uses_per_user: promocode.max_uses_per_user || 1,
        used_count: promocode.used_count || 0
      }
    });
  } catch (error) {
    console.error('❌ /api/promocodes/check:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера: ' + error.message });
  }
});

app.post('/api/promocodes/activate', async (req, res) => {
  try {
    const { userId, code } = req.body;
    if (!userId || !code) return res.status(400).json({ success: false, error: 'Не указаны данные' });

    const codeUpper = code.toUpperCase();
    const now = new Date();

    let promocode = null;
    if (sql) {
      const [result] = await sql`SELECT * FROM promocodes WHERE UPPER(code) = ${codeUpper}`;
      promocode = result;
    }

    if (!promocode) return res.status(404).json({ success: false, error: 'Промокод не найден' });
    if (!promocode.active) return res.status(400).json({ success: false, error: '❌ Промокод неактивен' });

    if (promocode.max_uses && promocode.used_count >= promocode.max_uses) {
      return res.status(400).json({ success: false, error: `❌ Промокод больше недействителен (${promocode.used_count}/${promocode.max_uses})` });
    }

    const usedBy = promocode.used_by || [];
    const userUseCount = usedBy.filter(id => id === userId).length;
    const maxPerUser = promocode.max_uses_per_user || 1;

    if (userUseCount >= maxPerUser) {
      return res.status(400).json({ success: false, error: `❌ Вы уже использовали этот промокод ${userUseCount} раз(а). Максимум: ${maxPerUser}` });
    }

    if (promocode.valid_from && now < new Date(promocode.valid_from)) {
      return res.status(400).json({ success: false, error: `📅 Промокод начнет действовать с ${new Date(promocode.valid_from).toLocaleDateString('ru-RU')}` });
    }

    if (promocode.valid_until && now > new Date(promocode.valid_until)) {
      return res.status(400).json({ success: false, error: `⏰ Период действия промокода истек ${new Date(promocode.valid_until).toLocaleDateString('ru-RU')}` });
    }

    usedBy.push(userId);
    const newUsedCount = (promocode.used_count || 0) + 1;

    if (sql) {
      await sql`
        UPDATE promocodes
        SET used_count = ${newUsedCount}, used_by = ${JSON.stringify(usedBy)}, updated_at = NOW()
        WHERE code = ${promocode.code}
      `;
    }

    const promoType = String(promocode.type).toLowerCase();

    if (promoType === 'balance') {
      let newBalance = null;
      if (sql) {
        const [user] = await sql`SELECT balance FROM users WHERE discord_id = ${userId}`;
        if (user) {
          newBalance = (user.balance || 0) + promocode.value;
          await sql`UPDATE users SET balance = ${newBalance} WHERE discord_id = ${userId}`;
        }
      }

      return res.json({
        success: true,
        message: `💰 Баланс пополнен на ${promocode.value} ₽`,
        newBalance, value: promocode.value, type: 'balance', code: promocode.code, used_at: now.toISOString()
      });
    }

    if (promoType === 'discount') {
      let expiresAt = null;
      if (promocode.valid_days && promocode.valid_days > 0) {
        expiresAt = new Date(now);
        expiresAt.setDate(expiresAt.getDate() + promocode.valid_days);
      }

      return res.json({
        success: true,
        message: `✓ Промокод "${promocode.code}" активирован! Скидка ${promocode.value}%`,
        newBalance: null, value: promocode.value, type: 'discount',
        code: promocode.code, expires_at: expiresAt,
        valid_days: promocode.valid_days, used_at: now.toISOString()
      });
    }

    return res.status(400).json({ success: false, error: `❌ Неизвестный тип промокода: ${promocode.type}` });
  } catch (error) {
    console.error('❌ /api/promocodes/activate:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка активации промокода: ' + error.message });
  }
});

app.get('/api/promocodes/active/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    let activePromocodes = [];

    if (sql) {
      const userPromocodes = await sql`SELECT * FROM promocodes WHERE used_by ? ${userId}`;

      activePromocodes = userPromocodes
        .filter(promo => {
          if (promo.type !== 'discount') return false;
          if (promo.valid_days && promo.valid_days > 0) {
            const usedAt = promo.updated_at;
            const expiresAt = new Date(usedAt);
            expiresAt.setDate(expiresAt.getDate() + promo.valid_days);
            return new Date() <= expiresAt;
          }
          if (promo.valid_until) return new Date() <= new Date(promo.valid_until);
          return true;
        })
        .map(promo => ({
          code: promo.code, value: promo.value, type: 'discount',
          appliedAt: promo.updated_at,
          expires_at: promo.valid_days ?
            new Date(new Date(promo.updated_at).getTime() + promo.valid_days * 24 * 60 * 60 * 1000) :
            promo.valid_until,
          product_ids: promo.product_ids || []
        }));
    }

    res.json({ success: true, promocodes: activePromocodes });
  } catch (error) {
    console.error('❌ /api/promocodes/active:', error.message);
    res.json({ success: true, promocodes: [] });
  }
});

app.post('/api/promocodes/save-active', async (req, res) => {
  try {
    const { userId, activeDiscounts } = req.body;
    if (sql) {
      await sql`UPDATE users SET active_promocodes = ${JSON.stringify(activeDiscounts)} WHERE discord_id = ${userId}`;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('❌ /api/promocodes/save-active:', error.message);
    res.json({ success: false });
  }
});

app.post('/api/promocodes/remove-active', async (req, res) => {
  try {
    const { userId, code } = req.body;
    if (sql) {
      const [user] = await sql`SELECT active_promocodes FROM users WHERE discord_id = ${userId}`;
      const activePromocodes = (user?.active_promocodes || []).filter(p => p.code !== code);
      await sql`UPDATE users SET active_promocodes = ${JSON.stringify(activePromocodes)} WHERE discord_id = ${userId}`;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('❌ /api/promocodes/remove-active:', error.message);
    res.json({ success: false });
  }
});

app.get('/api/promocodes/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    let promocodes = [];
    if (sql) {
      promocodes = await sql`
        SELECT code, type, value, used_count, used_by, valid_from, valid_until, valid_days,
               max_uses, max_uses_per_user, created_at, updated_at
        FROM promocodes WHERE used_by ? ${userId}
        ORDER BY updated_at DESC
      `;
    }

    const formattedPromocodes = promocodes.map(promo => {
      const usedByList = promo.used_by || [];
      const usedAt = usedByList.includes(userId) ? promo.updated_at : promo.created_at;

      return {
        code: promo.code, type: promo.type, value: promo.value,
        usedAt,
        usedAtFormatted: usedAt ? new Date(usedAt).toLocaleString('ru-RU', {
          day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : 'Дата неизвестна',
        valid_from: promo.valid_from, valid_until: promo.valid_until,
        valid_days: promo.valid_days, max_uses: promo.max_uses,
        max_uses_per_user: promo.max_uses_per_user || 1
      };
    });

    res.json({ success: true, promocodes: formattedPromocodes, total: formattedPromocodes.length });
  } catch (error) {
    console.error('❌ /api/promocodes/user:', error.message);
    res.json({ success: true, promocodes: [], total: 0 });
  }
});

// ============================================================
// REVIEWS
// ============================================================

app.get('/api/reviews', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    if (!sql) return res.json({
      success: true,
      reviews: reviewsData.reviews || [],
      stats: reviewsData.stats,
      pagination: { total: 0, page: 1, limit: parseInt(limit), totalPages: 0 }
    });

    const reviews = await sql`
      SELECT * FROM reviews
      ORDER BY created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `;

    const [stats] = await sql`
      SELECT
        COUNT(*) as total_reviews,
        AVG(rating) as avg_rating,
        SUM(CASE WHEN verified_purchase = true THEN 1 ELSE 0 END) as verified_purchases,
        SUM(helpful) as total_helpful
      FROM reviews
    `;

    res.json({
      success: true,
      reviews,
      stats: {
        totalReviews: parseInt(stats.total_reviews) || 0,
        averageRating: parseFloat(stats.avg_rating) || 0,
        verifiedPurchases: parseInt(stats.verified_purchases) || 0,
        totalHelpful: parseInt(stats.total_helpful) || 0
      },
      pagination: {
        total: parseInt(stats.total_reviews) || 0,
        page: parseInt(page), limit: parseInt(limit),
        totalPages: Math.ceil((parseInt(stats.total_reviews) || 0) / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ GET /api/reviews:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка загрузки отзывов' });
  }
});

app.post('/api/reviews', async (req, res) => {
  try {
    const { userId, name, productId, productName, rating, text } = req.body;

    if (!userId || !name || !productId || !productName || !rating || !text) {
      return res.status(400).json({ success: false, error: 'Заполните все обязательные поля' });
    }
    if (text.length < 10) return res.status(400).json({ success: false, error: 'Отзыв минимум 10 символов' });

    if (!sql) return res.status(503).json({ success: false, error: 'БД недоступна' });

    const [user] = await sql`SELECT * FROM users WHERE discord_id = ${userId}`;

    const avatar = user?.avatar
      ? `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/0.png`;

    const orders = user?.orders || [];
    const hasPurchased = orders.some(order =>
      order.productName === productName || order.productId === productId
    );

    const reviewId = `rev_${Date.now()}`;
    const now = new Date().toISOString();

    await sql`
      INSERT INTO reviews (id, user_id, name, avatar, rating, product_id, product_name, text,
        verified_purchase, verified, helpful, created_at, updated_at)
      VALUES (${reviewId}, ${userId}, ${name}, ${avatar}, ${parseInt(rating)}, ${productId},
        ${productName}, ${text}, ${hasPurchased}, ${user?.badges?.verified || false}, 0, ${now}, ${now})
    `;

    if (WEBHOOK_REVIEW) {
      axios.post(WEBHOOK_REVIEW, {
        embeds: [{
          title: '<:Wave:1386273780556496967> Новый отзыв!',
          description: `**${name}** оставил отзыв на товар **${productName}**`,
          color: 0xFEE75C,
          fields: [
            { name: '<a:Dot:1386279213278953545> Оценка', value: '⭐'.repeat(parseInt(rating)), inline: true },
            { name: '<a:Dot:1386279213278953545> Текст', value: text.substring(0, 100) + (text.length > 100 ? '...' : ''), inline: false }
          ],
          timestamp: now
        }]
      }).catch(console.error);
    }

    res.json({
      success: true,
      message: 'Отзыв успешно добавлен',
      review: {
        id: reviewId, userId, name, avatar, rating: parseInt(rating),
        productId, productName, text,
        verifiedPurchase: hasPurchased,
        verified: user?.badges?.verified || false,
        helpful: 0, createdAt: now
      }
    });
  } catch (error) {
    console.error('❌ POST /api/reviews:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка при создании отзыва' });
  }
});

app.post('/api/reviews/:id/helpful', async (req, res) => {
  try {
    const reviewId = req.params.id;
    if (!sql) return res.status(503).json({ success: false, error: 'БД недоступна' });

    await sql`UPDATE reviews SET helpful = helpful + 1 WHERE id = ${reviewId}`;
    const [updated] = await sql`SELECT helpful FROM reviews WHERE id = ${reviewId}`;

    res.json({ success: true, message: 'Спасибо за оценку!', helpful: updated?.helpful || 0 });
  } catch (error) {
    console.error('❌ /api/reviews/:id/helpful:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка при отметке' });
  }
});

// ============================================================
// NOTIFICATIONS / ERRORS / STATS / WEBHOOK
// ============================================================

app.get('/api/notifications/user/:userId', async (req, res) => {
  try {
    if (!sql) return res.json({ success: true, notifications: [] });
    const userId = req.params.userId;
    const notifications = await sql`
      SELECT * FROM notifications WHERE user_id = ${userId}
      ORDER BY created_at DESC LIMIT 50
    `;
    res.json({ success: true, notifications });
  } catch (error) {
    console.error('❌ GET /api/notifications:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.post('/api/notifications/:id/read', async (req, res) => {
  try {
    if (!sql) return res.json({ success: true });
    await sql`UPDATE notifications SET read = true WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (error) {
    console.error('❌ POST /api/notifications/read:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.post('/api/notifications/purchase', async (req, res) => {
  try {
    if (!sql) return res.json({ success: true });
    const { userId, productName, amount, orderId } = req.body;
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await sql`
      INSERT INTO notifications (id, user_id, type, title, message, data, created_at)
      VALUES (${notificationId}, ${userId}, 'purchase', 'Новая покупка',
        ${`Вы купили ${productName} за ${amount} ₽`},
        ${JSON.stringify({ productName, amount, orderId })}, ${new Date().toISOString()})
    `;
    res.json({ success: true });
  } catch (error) {
    console.error('❌ POST /api/notifications/purchase:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.post('/api/notifications/registration', async (req, res) => {
  try {
    if (!sql) return res.json({ success: true });
    const { userId, username } = req.body;
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await sql`
      INSERT INTO notifications (id, user_id, type, title, message, data, created_at)
      VALUES (${notificationId}, ${userId}, 'registration', 'Добро пожаловать!',
        ${`${username}, вы успешно зарегистрировались в BHStore`},
        ${JSON.stringify({ username })}, ${new Date().toISOString()})
    `;
    res.json({ success: true });
  } catch (error) {
    console.error('❌ POST /api/notifications/registration:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.post('/api/notifications/error', async (req, res) => {
  try {
    if (!sql) return res.json({ success: true });
    const { errorType, errorMessage, userId, userAgent, url } = req.body;
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await sql`
      INSERT INTO errors (id, type, message, user_id, user_agent, url, created_at)
      VALUES (${errorId}, ${errorType}, ${errorMessage}, ${userId || null}, ${userAgent}, ${url}, ${new Date().toISOString()})
    `;
    res.json({ success: true });
  } catch (error) {
    console.error('❌ POST /api/notifications/error:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.post('/api/stats/save', async (req, res) => {
  try {
    if (!sql) return res.json({ success: true });
    const stats = req.body;
    await sql`INSERT INTO stats (data, created_at) VALUES (${JSON.stringify(stats)}, ${new Date().toISOString()})`;
    res.json({ success: true });
  } catch (error) {
    console.error('❌ POST /api/stats/save:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.post('/api/webhook/send', async (req, res) => {
  try {
    const { title, description, color, fields } = req.body;
    if (!WEBHOOK_CHAT) return res.status(500).json({ success: false, error: 'Webhook не настроен' });

    await axios.post(WEBHOOK_CHAT, {
      embeds: [{
        title: title || '💬 Новое сообщение',
        description: description || '',
        color: color || 0x5865F2,
        fields: fields || [],
        timestamp: new Date().toISOString()
      }]
    });
    res.json({ success: true });
  } catch (error) {
    console.error('❌ POST /api/webhook/send:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка отправки' });
  }
});

// ============================================================
// UPDATE BALANCE (legacy, С АДМИН-ПРОВЕРКОЙ — было без неё)
// ============================================================

app.post('/api/update-balance', async (req, res) => {
  try {
    const decoded = getAuthFromReq(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const isAdmin = await isAdminUserAsync(decoded);
    if (!isAdmin) return res.status(403).json({ success: false, error: 'Требуются права администратора' });

    const { userId, amount, reason } = req.body;
    if (!userId || !amount) return res.status(400).json({ success: false, error: 'Не указаны userId или amount' });

    if (!sql) return res.status(503).json({ success: false, error: 'БД недоступна' });

    const [user] = await sql`SELECT * FROM users WHERE discord_id = ${userId}`;
    if (!user) return res.status(404).json({ success: false, error: 'Пользователь не найден' });

    if (amount < 0 && (user.balance || 0) < Math.abs(amount)) {
      return res.status(400).json({ success: false, error: 'Недостаточно средств на балансе' });
    }

    const newBalance = (user.balance || 0) + parseFloat(amount);
    await sql`UPDATE users SET balance = ${newBalance} WHERE discord_id = ${userId}`;

    res.json({ success: true, message: 'Баланс обновлен', newBalance });
  } catch (error) {
    console.error('❌ /api/update-balance:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка обновления баланса' });
  }
});

// ============================================================
// CATCH-ALL для SPA (опционально)
// ============================================================

// Не нужен, если фронт — статика. Раскомментируй если нужно.
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, '../../index.html'));
// });

// ============================================================
// EXPORT
// ============================================================

module.exports.handler = serverless(app);