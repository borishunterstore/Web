const express = require('express');
const axios = require('axios');
const cors = require('cors');
const serverless = require('serverless-http');
const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config();
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'https://bhstore.netlify.app/auth/discord/callback';
const JWT_SECRET = process.env.JWT_SECRET || 'bhstore-super-secret-key-2024-change-this';

console.log('🚀 SERVER FUNCTION STARTED');

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

function decodeAuthToken(token) {
  if (!token) return null;
  
  try {
      // Сначала пробуем как JWT
      const decoded = jwt.verify(token, JWT_SECRET);
      return decoded;
  } catch (jwtError) {
      // Если не JWT, пробуем как base64 (для старых токенов)
      try {
          // Правильное декодирование base64, а НЕ рекурсия!
          const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
          return decoded;
      } catch (base64Error) {
          console.error('❌ Не удалось декодировать токен');
          return null;
      }
  }
}

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
});

console.log('🔧 Discord OAuth Settings:');
console.log('- CLIENT_ID:', DISCORD_CLIENT_ID ? '✅' : '❌');
console.log('- CLIENT_SECRET:', DISCORD_CLIENT_SECRET ? '✅' : '❌');
console.log('- REDIRECT_URI:', DISCORD_REDIRECT_URI);

const app = express();
// ========== БЕЗОПАСНОСТЬ (ОБЛЕГЧЁННАЯ ВЕРСИЯ ДЛЯ DISCORD) ==========
app.use((req, res, next) => {
  // Базовые заголовки безопасности (без CSP)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');  // Изменено с DENY на SAMEORIGIN
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // CORS для Discord
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// CSRF защита (только для POST запросов)
app.use((req, res, next) => {
  if(req.method === 'GET') {
      const csrfToken = crypto.randomBytes(32).toString('hex');
      res.cookie('csrf', csrfToken, { httpOnly: true, secure: true, sameSite: 'lax' }); // Изменено strict на lax
      res.locals.csrfToken = csrfToken;
  }
  next();
});

app.use(cors({
  origin: ['https://bhstore.netlify.app', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// OPTIONS обработчик для CORS preflight
app.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(200).end();
});

// Rate limiting для Telegram
const telegramLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { success: false, error: 'Слишком много попыток. Подождите 15 минут.' }
});

setInterval(() => {
  if(global.telegramCodes) {
    const now = Date.now();
    let deleted = 0;
    for(const [key, value] of Object.entries(global.telegramCodes)) {
      if(value.expiresAt < now) {
        delete global.telegramCodes[key];
        deleted++;
      }
    }
    if(deleted > 0) console.log(`🧹 Очищено ${deleted} просроченных кодов. Осталось: ${Object.keys(global.telegramCodes).length}`);
  }
}, 5 * 60 * 1000);

let sql;
try {
  if (process.env.DATABASE_URL) {
    sql = neon(process.env.DATABASE_URL);
    
    (async () => {
      try {
        await sql`SELECT 1`;
        console.log('Подключено к БД');
      } catch (err) {
        console.error('Ошибка подключения к БД', err.message);
      }
    })();
  } else {
    console.log('⚠️ DATABASE_URL не установлен, работаем без БД');
  }
} catch (error) {
  console.error('❌ Ошибка инициализации БД:', error.message);
  sql = null;
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../')));
let users = {};
let chatStore = {};
let reviewsData = { reviews: [], stats: { totalReviews: 0, averageRating: 0 } };
let promocodes = {};

// Тестовые данные
const initTestData = () => {
  users = {};
  
  promocodes = {
  };
  
  reviewsData = {
    reviews: [],
    stats: {
      totalReviews: 1,
      averageRating: 5,
      verifiedPurchases: 1,
      totalHelpful: 5
    }
  };
};

initTestData();

let productsData = [];
try {
  const productsPath = path.join(__dirname, '../../data/products.json');
  if (fs.existsSync(productsPath)) {
    productsData = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
    console.log(`✅ Загружено ${productsData.length} товаров из products.json`);
  } else {
    console.log('⚠️ Файл data/products.json не найден, использую тестовые товары');
    productsData = getTestProducts();
  }
} catch (error) {
  console.error('❌ Ошибка загрузки товаров:', error.message);
  productsData = getTestProducts();
}

// ============================================
// Инициализация БД
// ============================================
async function initDatabase() {
  if (!sql) {
    console.log('⚠️ БД не доступна, пропускаем инициализацию');
    return;
  }
  
  try {
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

    // БД Users
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        discord_id TEXT PRIMARY KEY,
        username TEXT,
        email TEXT,
        avatar TEXT,
        balance INTEGER DEFAULT 0,
        badges JSONB DEFAULT '{}',
        orders JSONB DEFAULT '[]',
        used_promocodes JSONB DEFAULT '[]',
        active_promocodes JSONB DEFAULT '[]',
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // БД Chats
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
    
    // БД Reviews
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
    
    // БД PromoCodes
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      max_uses_per_user INTEGER DEFAULT 1
    )
  `;

    // Таблица уведомлений
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

    // БД Errors
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

    // БД Stats
    await sql`
      CREATE TABLE IF NOT EXISTS stats (
        id SERIAL PRIMARY KEY,
        data JSONB,
        created_at TIMESTAMP
      )
    `;
    
    // БД Transactions
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

    // БД Products
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
    await sql`
      CREATE TABLE IF NOT EXISTS shop_settings (
        id SERIAL PRIMARY KEY,        setting_key TEXT UNIQUE NOT NULL,
        setting_value BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by TEXT
      )
    `;

    await sql`
    ALTER TABLE promocodes 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  `;
    console.log('БД инициализирована');
    await checkAndInsertProducts();
    
  } catch (error) {
    console.error('Ошибка инициализации БД:', error.message);
  }
}

async function checkAndInsertProducts() {
  if (!sql) return;
  try {
    const [count] = await sql`SELECT COUNT(*) as count FROM products`;
    if (parseInt(count.count) === 0) {
      console.log('⚠️ В БД нет товаров. Чтобы добавить товары, используйте админ-панель.');
    }
  } catch (error) {
    console.error('❌ Ошибка проверки товаров:', error.message);
  }
}

async function insertTestProducts() {
  if (!sql) return;
  
  try {
    const testProducts = [];
    
    for (const product of testProducts) {
      await sql`
        INSERT INTO products (
          id, name, description, price, category, icon, image, features, popular, discount
        ) VALUES (
          ${product.id},
          ${product.name},
          ${product.description},
          ${product.price},
          ${product.category},
          ${product.icon},
          ${product.image},
          ${product.features},
          ${product.popular},
          ${product.discount}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          price = EXCLUDED.price,
          category = EXCLUDED.category,
          icon = EXCLUDED.icon,
          image = EXCLUDED.image,
          features = EXCLUDED.features,
          popular = EXCLUDED.popular,
          discount = EXCLUDED.discount
      `;
    }
    
    console.log('Тестовые товары добавлены в БД');
  } catch (error) {
    console.error('Ошибка добавления тестовых товаров:', error.message);
  }
}

if (sql) {
  initDatabase();
}

// Статус авторизации
app.get('/api/auth-status', async (req, res) => {
  try {
    if (!sql) {
      return res.json({
        success: true,
        auth_enabled: true
      });
    }
    
    const [setting] = await sql`
      SELECT setting_value FROM shop_settings WHERE setting_key = 'auth_enabled'
    `;
    
    res.json({
      success: true,
      auth_enabled: setting?.setting_value !== false
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения статуса авторизации:', error.message);
    res.json({
      success: true,
      auth_enabled: true
    });
  }
});

// ОСТАВИТЬ - получение настроек
app.get('/api/shop-settings', async (req, res) => {
  try {
    if (!sql) {
      return res.json({
        success: true,
        settings: {
          shop_open: true,
          auth_enabled: true,
          registration_enabled: true,
          site_access: true
        }
      });
    }
    
    const settings = await sql`
      SELECT setting_key, setting_value FROM shop_settings
    `;
    
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.setting_key] = setting.setting_value;
    });
    
    res.json({
      success: true,
      settings: settingsObj
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения настроек:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка получения настроек' 
    });
  }
});

// ОСТАВИТЬ - правильный POST
app.post('/api/admin/shop-settings', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = decodeAuthToken(token);

    
    const isAdmin = decoded.id === '992442453833547886';
    
    if (!isAdmin) {
      if (sql) {
        const [user] = await sql`
          SELECT badges FROM users WHERE discord_id = ${decoded.id}
        `;
        if (!user?.badges?.admin) {
          return res.status(403).json({ success: false, error: 'Требуются права администратора' });
        }
      } else {
        return res.status(403).json({ success: false, error: 'Требуются права администратора' });
      }
    }
    
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
      
      console.log(`✅ Настройка ${setting_key} изменена на ${setting_value} администратором ${decoded.username || decoded.id}`);
    }
    
    res.json({
      success: true,
      message: `Настройка "${setting_key}" обновлена`,
      setting: {
        key: setting_key,
        value: setting_value
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка обновления настроек:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка обновления настроек' 
    });
  }
});

// Запускаем инициализацию БД
if (sql) {
  (async () => {
    await initDatabase();
    await initShopSettings();
  })();
}

async function initShopSettings() {
  if (!sql) return;
  
  const defaultSettings = [
    { key: 'shop_open', value: true },
    { key: 'auth_enabled', value: true },
    { key: 'registration_enabled', value: true },
    { key: 'site_access', value: true }
  ];
  
  for (const setting of defaultSettings) {
    const [exists] = await sql`
      SELECT 1 FROM shop_settings WHERE setting_key = ${setting.key}
    `;
    if (!exists) {
      await sql`
        INSERT INTO shop_settings (setting_key, setting_value, updated_at)
        VALUES (${setting.key}, ${setting.value}, CURRENT_TIMESTAMP)
      `;
    }
  }
  console.log('✅ Настройки магазина инициализированы');
}

// Обновите эндпоинт /api/products - проверка статуса магазина
app.get('/api/products', async (req, res) => {
  console.log('📦 GET /api/products');
  
  // Проверяем открыт ли магазин
  if (sql) {
    try {
      const [setting] = await sql`
        SELECT setting_value FROM shop_settings WHERE setting_key = 'shop_open'
      `;
      
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
      console.error('Ошибка проверки статуса магазина:', error.message);
    }
  }
  
  res.json({
    success: true,
    products: productsData,
    total: productsData.length,
    shop_open: true
  });
});

// ============================================
// TELEGRAM AUTHENTICATION
// ============================================

const TELEGRAM_BOT_ID = '6876007284';
const TELEGRAM_BOT_TOKEN = '6876007284:AAH5R2BCqS8RPafZWg5s_0v-DJfoiJsiQco';
console.log('🤖 TELEGRAM_BOT_TOKEN загружен:', TELEGRAM_BOT_TOKEN ? 'Да' : 'Нет');

// Отправка кода в Telegram
app.post('/api/telegram/send-code', telegramLimiter, async (req, res) => {
  try {
      const { id, name } = req.body;
      
      // Валидация
      if(!id || !/^\d+$/.test(id)) {
          return res.status(400).json({ success: false, error: 'Неверный формат ID' });
      }
      
      if(!name || name.length < 2 || name.length > 50) {
          return res.status(400).json({ success: false, error: 'Имя должно быть от 2 до 50 символов' });
      }
      
      // Инициализируем хранилище если нужно
      if(!global.telegramCodes) global.telegramCodes = {};
      
      // Ограничиваем общее количество кодов в памяти (защита от спама)
      const codesCount = Object.keys(global.telegramCodes).length;
      if(codesCount > 1000) {
          // Очищаем самые старые коды
          const sorted = Object.entries(global.telegramCodes).sort((a,b) => a[1].expiresAt - b[1].expiresAt);
          for(let i = 0; i < 100; i++) {
              if(sorted[i]) delete global.telegramCodes[sorted[i][0]];
          }
          console.log(`🧹 Очищено 100 старых кодов, осталось: ${Object.keys(global.telegramCodes).length}`);
      }
      
      // Если уже есть активный код для этого пользователя - удаляем его (нельзя иметь несколько активных)
      if(global.telegramCodes[id]) {
          delete global.telegramCodes[id];
          console.log(`🗑️ Удалён старый код для пользователя ${id}`);
      }
      
      // Генерируем новый код
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 минут
      
      // Сохраняем код
      global.telegramCodes[id] = {
          code: verificationCode,
          name: name,
          expiresAt: expiresAt,
          attempts: 0,
          createdAt: Date.now()
      };
      
      // Отправляем сообщение в Telegram
      const message = `🔐 **КОД АВТОРИЗАЦИИ BHStore**\n\nЗдравствуйте, ${name}!\n\nВаш код для входа: \`${verificationCode}\`\n\n⚠️ Никому не сообщайте код!\n⏰ Код действителен 5 минут.\n\n✅ Код можно использовать ТОЛЬКО ОДИН РАЗ!`;
      
      const telegramResponse = await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          chat_id: parseInt(id),
          text: message,
          parse_mode: 'Markdown'
      });
      
      console.log(`✅ Код ${verificationCode} отправлен для ${id}, действителен до ${new Date(expiresAt).toLocaleTimeString()}`);
      
      res.json({ 
          success: true, 
          message: 'Код отправлен в Telegram',
          expiresIn: 300 // 5 минут в секундах
      });
      
  } catch(error) {
      console.error('❌ Ошибка отправки кода:', error.message);
      
      let errorMessage = 'Ошибка отправки кода. Проверьте ID и что бот не заблокирован';
      
      if(error.response?.data?.description) {
          const desc = error.response.data.description;
          if(desc.includes('chat not found')) {
              errorMessage = '❌ Пользователь не найден! Напишите боту @Meentioned_bot команду /start';
          } else if(desc.includes('bot was blocked')) {
              errorMessage = '❌ Бот заблокирован! Разблокируйте @Meentioned_bot';
          } else if(desc.includes('Forbidden')) {
              errorMessage = '❌ Доступ запрещен! Напишите боту @Meentioned_bot команду /start';
          } else {
              errorMessage = desc;
          }
      }
      
      res.status(500).json({ 
          success: false, 
          error: errorMessage
      });
  }
});


// Telegram авторизация через deep link (код из бота)
// Telegram авторизация через deep link
app.post('/api/auth/telegram/deep', async (req, res) => {
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
    
    // ========== СОХРАНЯЕМ СЕССИЮ В БД ==========
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 минут
    
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
      console.log(`✅ Сессия сохранена в БД: ${token}`);
    }
    // ===========================================
    
    const jwtToken = jwt.sign(
      { ...userData },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({ success: true, token: jwtToken, user: userData });
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Проверка статуса Telegram бота
app.get('/api/telegram/status', async (req, res) => {
  try {
    const response = await axios.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
    res.json({
      success: true,
      bot: response.data.result,
      status: 'active'
    });
  } catch (error) {
    res.json({
      success: false,
      status: 'error',
      error: error.message
    });
  }
});

app.get('/api/auth/telegram/callback', async (req, res) => {
  const url = `/auth/telegram/callback?${new URLSearchParams(req.query).toString()}`;
  res.redirect(url);
});

const RECAPTCHA_SECRET_KEY = '6LfunBMtAAAAAGR80_xnmH5yzFos93c62uq3BpRl';
const RECAPTCHA_SITE_KEY = '6LfunBMtAAAAAERlHV1wjXssrw5yYmgPUmxvVUAQ';

// Проверка reCAPTCHA на сервере
async function verifyRecaptcha(token) {
    if (!token) return false;
    try {
        const response = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
            params: {
                secret: RECAPTCHA_SECRET_KEY,
                response: token
            }
        });
        return response.data.success === true;
    } catch (error) {
        console.error('❌ Ошибка проверки reCAPTCHA:', error.message);
        return false;
    }
}

// Создание сессии для Telegram авторизации (с сайта)
app.post('/api/telegram/create-session', async (req, res) => {
    try {
        const { recaptchaToken } = req.body;
        
        // Проверяем reCAPTCHA
        const isHuman = await verifyRecaptcha(recaptchaToken);
        if (!isHuman) {
            return res.status(400).json({ 
                success: false, 
                error: 'Пожалуйста, подтвердите, что вы не робот' 
            });
        }
        
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 минут
        
        if (sql) {
            await sql`
                INSERT INTO auth_sessions (token, user_id, username, name, created_at, expires_at)
                VALUES (${token}, 'pending', 'pending', 'pending', NOW(), ${expiresAt.toISOString()})
                ON CONFLICT (token) DO UPDATE SET
                    expires_at = ${expiresAt.toISOString()}
            `;
        }
        
        const botLink = `https://t.me/Meentioned_bot?start=${token}`;
        
        res.json({
            success: true,
            botLink: botLink,
            token: token,
            expiresIn: 600
        });
        
    } catch (error) {
        console.error('❌ Ошибка создания сессии:', error.message);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.get('/auth/telegram/callback', async (req, res) => {
  try {
      const { token, telegram_id, username, name } = req.query;
      
      if (!token || !telegram_id) {
          return res.status(400).send('Ошибка: недостаточно параметров');
      }
      
      // Проверяем сессию в БД
      let session = null;
      if (sql) {
          const [row] = await sql`
              SELECT * FROM auth_sessions WHERE token = ${token} AND expires_at > NOW()
          `;
          session = row;
      }
      
      if (!session) {
          return res.status(400).send('Сессия истекла или не найдена. Запросите новую ссылку.');
      }
      
      // Обновляем сессию данными пользователя
      if (sql) {
          await sql`
              UPDATE auth_sessions 
              SET user_id = ${telegram_id}, 
                  username = ${username || ''}, 
                  name = ${name || ''}
              WHERE token = ${token}
          `;
      }
      
      // Отправляем HTML страницу с формой регистрации
      const html = `
          <!DOCTYPE html>
          <html>
          <head>
              <meta charset="UTF-8">
              <title>Завершение регистрации | BHStore</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <script src="https://www.google.com/recaptcha/api.js" async defer></script>
              <style>
                  * { margin: 0; padding: 0; box-sizing: border-box; }
                  body {
                      background: linear-gradient(135deg, #0f172a 0%, #0a0a0f 100%);
                      color: white;
                      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
                      display: flex;
                      justify-content: center;
                      align-items: center;
                      min-height: 100vh;
                      padding: 20px;
                  }
                  .container {
                      background: rgba(42, 43, 54, 0.95);
                      backdrop-filter: blur(10px);
                      padding: 40px;
                      border-radius: 24px;
                      border: 1px solid #40444b;
                      max-width: 450px;
                      width: 100%;
                  }
                  h2 { margin-bottom: 25px; text-align: center; color: #5865F2; }
                  .form-group { margin-bottom: 20px; }
                  label { display: block; margin-bottom: 8px; color: #b9bbbe; font-size: 0.9rem; }
                  input {
                      width: 100%;
                      padding: 12px 16px;
                      background: #1e1f29;
                      border: 1px solid #40444b;
                      border-radius: 12px;
                      color: white;
                      font-size: 1rem;
                      transition: all 0.2s;
                  }
                  input:focus {
                      outline: none;
                      border-color: #5865F2;
                      box-shadow: 0 0 0 2px rgba(88, 101, 242, 0.2);
                  }
                  .info-box {
                      background: #1e1f29;
                      padding: 15px;
                      border-radius: 12px;
                      margin-bottom: 20px;
                      border-left: 3px solid #57F287;
                  }
                  .info-box p {
                      margin: 5px 0;
                      color: #b9bbbe;
                      font-size: 0.85rem;
                  }
                  .info-box strong {
                      color: white;
                  }
                  .g-recaptcha {
                      display: flex;
                      justify-content: center;
                      margin: 20px 0;
                  }
                  button {
                      width: 100%;
                      padding: 14px;
                      background: linear-gradient(135deg, #5865F2, #4752c4);
                      color: white;
                      border: none;
                      border-radius: 12px;
                      font-size: 1rem;
                      font-weight: 600;
                      cursor: pointer;
                      transition: all 0.2s;
                  }
                  button:hover {
                      transform: translateY(-2px);
                      box-shadow: 0 5px 20px rgba(88, 101, 242, 0.3);
                  }
                  button:disabled {
                      opacity: 0.5;
                      cursor: not-allowed;
                      transform: none;
                  }
                  .error-message {
                      color: #ED4245;
                      font-size: 0.85rem;
                      margin-top: 5px;
                      display: none;
                  }
                  .success-message {
                      color: #57F287;
                      text-align: center;
                      margin-top: 15px;
                      display: none;
                  }
                  .optional {
                      color: #72767d;
                      font-size: 0.75rem;
                      margin-top: 4px;
                  }
              </style>
          </head>
          <body>
              <div class="container">
                  <h2>🔐 Завершение регистрации</h2>
                  
                  <div class="info-box">
                      <p><strong>👤 Telegram аккаунт</strong></p>
                      <p>ID: <code>${telegram_id}</code></p>
                      <p>Имя: ${escapeHtml(name || username || 'Не указано')}</p>
                  </div>
                  
                  <form id="registerForm">
                      <div class="form-group">
                          <label>📧 Электронная почта <span class="optional">(необязательно)</span></label>
                          <input type="email" id="email" placeholder="example@mail.com">
                          <div class="optional">Если не указать, будет использован Telegram ID</div>
                      </div>
                      
                      <div class="form-group">
                          <label>🔒 Пароль <span style="color:#ED4245">*</span></label>
                          <input type="password" id="password" required placeholder="Введите пароль">
                          <div class="optional">Минимум 6 символов</div>
                      </div>
                      
                      <div class="form-group">
                          <label>🔒 Подтверждение пароля <span style="color:#ED4245">*</span></label>
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
                  
                  function onCaptchaComplete() {
                      captchaCompleted = true;
                      const submitBtn = document.getElementById('submitBtn');
                      if (submitBtn) submitBtn.disabled = false;
                  }
                  
                  document.getElementById('registerForm').addEventListener('submit', async (e) => {
                      e.preventDefault();
                      
                      const password = document.getElementById('password').value;
                      const confirmPassword = document.getElementById('confirm_password').value;
                      const email = document.getElementById('email').value;
                      const errorMsg = document.getElementById('errorMsg');
                      const successMsg = document.getElementById('successMsg');
                      const submitBtn = document.getElementById('submitBtn');
                      
                      errorMsg.style.display = 'none';
                      successMsg.style.display = 'none';
                      
                      if (!captchaCompleted) {
                          errorMsg.textContent = 'Пожалуйста, подтвердите, что вы не робот';
                          errorMsg.style.display = 'block';
                          return;
                      }
                      
                      if (password.length < 6) {
                          errorMsg.textContent = 'Пароль должен содержать минимум 6 символов';
                          errorMsg.style.display = 'block';
                          return;
                      }
                      
                      if (password !== confirmPassword) {
                          errorMsg.textContent = 'Пароли не совпадают';
                          errorMsg.style.display = 'block';
                          return;
                      }
                      
                      const recaptchaResponse = grecaptcha.getResponse();
                      if (!recaptchaResponse) {
                          errorMsg.textContent = 'Пожалуйста, подтвердите, что вы не робот';
                          errorMsg.style.display = 'block';
                          return;
                      }
                      
                      submitBtn.disabled = true;
                      submitBtn.textContent = 'Обработка...';
                      
                      try {
                          const response = await fetch('/api/auth/telegram/complete', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                  token: '${token}',
                                  telegram_id: '${telegram_id}',
                                  username: '${escapeHtml(username || '')}',
                                  name: '${escapeHtml(name || '')}',
                                  email: email,
                                  password: password,
                                  recaptchaToken: recaptchaResponse
                              })
                          });
                          
                          const data = await response.json();
                          
                          if (data.success) {
                              localStorage.setItem('bhstore_auth', JSON.stringify({
                                  id: data.user.id,
                                  username: data.user.username,
                                  email: data.user.email,
                                  token: data.token,
                                  authMethod: 'telegram'
                              }));
                              successMsg.textContent = '✅ Регистрация успешна! Перенаправление...';
                              successMsg.style.display = 'block';
                              setTimeout(() => {
                                  window.location.href = '/profile.html';
                              }, 2000);
                          } else {
                              errorMsg.textContent = data.error || 'Ошибка регистрации';
                              errorMsg.style.display = 'block';
                              submitBtn.disabled = false;
                              submitBtn.textContent = 'Завершить регистрацию';
                              grecaptcha.reset();
                              captchaCompleted = false;
                          }
                      } catch (err) {
                          errorMsg.textContent = 'Ошибка сервера. Попробуйте позже.';
                          errorMsg.style.display = 'block';
                          submitBtn.disabled = false;
                          submitBtn.textContent = 'Завершить регистрацию';
                      }
                  });
              </script>
          </body>
          </html>
      `;
      
      res.send(html);
      
  } catch (error) {
      console.error('❌ Ошибка callback:', error.message);
      res.status(500).send('Ошибка сервера');
  }
});

app.post('/api/auth/telegram/complete', async (req, res) => {
  try {
      const { token, telegram_id, username, name, email, password, recaptchaToken } = req.body;
      
      // Проверяем reCAPTCHA
      const isHuman = await verifyRecaptcha(recaptchaToken);
      if (!isHuman) {
          return res.status(400).json({ success: false, error: 'Пожалуйста, подтвердите, что вы не робот' });
      }
      
      // Проверяем сессию
      let session = null;
      if (sql) {
          const [row] = await sql`
              SELECT * FROM auth_sessions WHERE token = ${token} AND expires_at > NOW()
          `;
          session = row;
      }
      
      if (!session) {
          return res.status(400).json({ success: false, error: 'Сессия истекла. Запросите новую ссылку' });
      }
      
      // Хешируем пароль
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const userId = `tg_${telegram_id}`;
      const userDisplayName = name || username || `Telegram_${telegram_id}`;
      const userEmail = email && email.includes('@') ? email : null;
      
      let existingUser = null;
      if (sql) {
          const [row] = await sql`
              SELECT * FROM users WHERE discord_id = ${userId}
          `;
          existingUser = row;
      }
      
      if (existingUser) {
          // Обновляем существующего пользователя
          if (sql) {
              await sql`
                  UPDATE users 
                  SET username = ${userDisplayName},
                      email = ${userEmail},
                      password = ${hashedPassword}
                  WHERE discord_id = ${userId}
              `;
          }
      } else {
          // Создаём нового пользователя
          if (sql) {
              await sql`
                  INSERT INTO users (
                      discord_id, username, email, avatar, balance, badges, orders, password, frozen, privacy
                  ) VALUES (
                      ${userId}, 
                      ${userDisplayName}, 
                      ${userEmail}, 
                      NULL, 
                      0, 
                      '{}', 
                      '[]', 
                      ${hashedPassword},
                      false,
                      '{"show_avatar":true,"show_orders":true,"show_badges":true,"show_spent":true,"show_orders_count":true,"show_registered":true,"hide_profile":false,"frozen":false}'
                  )
              `;
          }
      }
      
      // Удаляем использованную сессию
      if (sql) {
          await sql`DELETE FROM auth_sessions WHERE token = ${token}`;
      }
      
      // Создаём JWT токен
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
      console.error('❌ Ошибка завершения регистрации:', error.message);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
  });
}

app.post('/api/auth/telegram/complete', async (req, res) => {
  try {
      const { token, telegram_id, username, name, email, password } = req.body;
      
      console.log('📝 Завершение регистрации:', { token, telegram_id, username, name, email });
      
      // Проверяем сессию
      let session = null;
      if (sql) {
          const [row] = await sql`
              SELECT * FROM auth_sessions WHERE token = ${token} AND expires_at > NOW()
          `;
          session = row;
      }
      
      if (!session) {
          return res.status(400).json({ success: false, error: 'Сессия истекла. Запросите новую ссылку' });
      }
      
      // Хешируем пароль
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const userId = `tg_${telegram_id}`;
      const userDisplayName = name || username || `Telegram_${telegram_id}`;
      // Email: если не указан, оставляем NULL (НЕ создаём фейковый)
      const userEmail = email && email.includes('@') ? email : null;
      
      let existingUser = null;
      if (sql) {
          const [row] = await sql` 
              SELECT * FROM users WHERE discord_id = ${userId}
          `;
          existingUser = row;
      }
      
      if (existingUser) {
          // Обновляем существующего пользователя
          if (sql) {
              await sql`
                  UPDATE users 
                  SET username = ${userDisplayName},
                      email = ${userEmail},
                      password = ${hashedPassword}
                  WHERE discord_id = ${userId}
              `;
          }
          console.log(`✅ Пользователь обновлён: ${userId}, email: ${userEmail || 'NULL'}`);
      } else {
          // Создаём нового пользователя
          if (sql) {
              await sql`
                  INSERT INTO users (
                      discord_id, username, email, avatar, balance, badges, orders, password, frozen, privacy
                  ) VALUES (
                      ${userId}, 
                      ${userDisplayName}, 
                      ${userEmail}, 
                      NULL, 
                      0, 
                      '{}', 
                      '[]', 
                      ${hashedPassword},
                      false,
                      '{"show_avatar":true,"show_orders":true,"show_badges":true,"show_spent":true,"show_orders_count":true,"show_registered":true,"hide_profile":false,"frozen":false}'
                  )
              `;
          }
          console.log(`✅ Новый пользователь создан: ${userId}, email: ${userEmail || 'NULL'}`);
      }
      
      // Удаляем использованную сессию
      if (sql) {
          await sql`DELETE FROM auth_sessions WHERE token = ${token}`;
      }
      
      // Создаём JWT токен
      const jwt = require('jsonwebtoken');
      const jwtToken = jwt.sign(
          { 
              id: userId, 
              username: userDisplayName, 
              email: userEmail,
              authMethod: 'telegram' 
          },
          JWT_SECRET,
          { expiresIn: '7d' }
      );
      
      res.json({
          success: true,
          token: jwtToken,
          user: {
              id: userId,
              username: userDisplayName,
              email: userEmail
          }
      });
      
  } catch (error) {
      console.error('❌ Ошибка завершения регистрации:', error.message);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Авторизация через Telegram
app.post('/api/auth/telegram', telegramLimiter, async (req, res) => {
  try {
      const { code, id, name } = req.body;
      
      if(!code || !/^\d{6}$/.test(code)) {
          return res.status(400).json({ success: false, error: 'Неверный формат кода' });
      }
      
      if(!global.telegramCodes || !global.telegramCodes[id]) {
          return res.status(400).json({ success: false, error: 'Код не найден. Запросите новый' });
      }
      
      const saved = global.telegramCodes[id];
      
      // Проверяем количество попыток
      saved.attempts = (saved.attempts || 0) + 1;
      if(saved.attempts > 3) {
          delete global.telegramCodes[id];
          return res.status(400).json({ success: false, error: 'Превышено количество попыток. Запросите новый код' });
      }
      
      // Проверяем код
      if(saved.code !== code) {
          return res.status(400).json({ 
              success: false, 
              error: `Неверный код. Осталось попыток: ${3 - saved.attempts}` 
          });
      }
      
      // Проверяем срок действия
      if(saved.expiresAt < Date.now()) {
          delete global.telegramCodes[id];
          return res.status(400).json({ success: false, error: 'Код истёк. Запросите новый' });
      }
      
      // ===== КРИТИЧНО: УДАЛЯЕМ КОД ПОСЛЕ УСПЕШНОЙ АВТОРИЗАЦИИ =====
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
      
      // Сохраняем пользователя в БД
      if(sql) {
          const [existing] = await sql`SELECT * FROM users WHERE discord_id = ${userId}`;
          if(!existing) {
              await sql`
                  INSERT INTO users (discord_id, username, email, avatar, balance, badges, frozen, privacy)
                  VALUES (${userId}, ${userDisplayName}, ${userData.email}, NULL, 0, '{}', false, '{"show_avatar":true,"show_orders":true,"show_badges":true,"show_spent":true,"show_orders_count":true,"show_registered":true,"hide_profile":false}')
              `;
              console.log(`✅ Новый Telegram пользователь создан: ${userId}`);
          } else {
              await sql`
                  UPDATE users 
                  SET username = ${userDisplayName}, 
                      email = ${userData.email}
                  WHERE discord_id = ${userId}
              `;
              console.log(`✅ Telegram пользователь обновлён: ${userId}`);
          }
      }
      
      // Создаём JWT токен
      const token = jwt.sign(
          { ...userData },
          JWT_SECRET,
          { expiresIn: '7d' }
      );
      
      console.log(`✅ Успешная авторизация для ${userId}, код ${code} удалён`);
      
      res.json({ 
          success: true, 
          token, 
          user: userData 
      });
      
  } catch(error) {
      console.error('❌ Ошибка авторизации:', error.message);
      res.status(500).json({ 
          success: false, 
          error: 'Ошибка сервера' 
      });
  }
});

// Проверка статуса Telegram бота
app.get('/api/telegram/status', async (req, res) => {
  try {
    const response = await axios.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
    res.json({
      success: true,
      bot: response.data.result,
      status: 'active'
    });
  } catch (error) {
    res.json({
      success: false,
      status: 'error',
      error: error.message
    });
  }
});

// Регистрация Telegram пользователя
app.post('/api/register-telegram', async (req, res) => {
  try {
    const { telegramId, username, email } = req.body;
    
    const [existingUser] = await sql`
      SELECT * FROM users WHERE discord_id = ${telegramId}
    `;
    
    if (existingUser) {
      return res.json({ success: true, message: 'Пользователь уже существует' });
    }
    
    await sql`
      INSERT INTO users (discord_id, username, email, balance, badges)
      VALUES (${telegramId}, ${username}, ${email}, 0, '{}')
    `;
    
    res.json({ success: true, message: 'Пользователь зарегистрирован' });
    
  } catch (error) {
    console.error('❌ Ошибка регистрации Telegram:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка регистрации' });
  }
});

// ============================================
// API для обновления данных пользователя (настройки профиля)
// ============================================

// Обновление email пользователя
app.put('/api/user/:userId/email', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = decodeAuthToken(token);

    const userId = req.params.userId;
    
    // Проверяем, что пользователь обновляет свой email
    if (decoded.id !== userId) {
      return res.status(403).json({ success: false, error: 'Доступ запрещен' });
    }
    
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Неверный формат email' });
    }
    
    if (sql) {
      await sql`
        UPDATE users 
        SET email = ${email}
        WHERE discord_id = ${userId}
      `;
    }
    
    console.log(`✅ Email пользователя ${userId} обновлён на ${email}`);
    
    res.json({
      success: true,
      message: 'Email успешно обновлён'
    });
    
  } catch (error) {
    console.error('❌ Ошибка обновления email:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Обновление аватарки пользователя
app.post('/api/user/:userId/avatar', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = decodeAuthToken(token);

    const userId = req.params.userId;
    
    // Проверяем, что пользователь обновляет свой аватар
    if (decoded.id !== userId) {
      return res.status(403).json({ success: false, error: 'Доступ запрещен' });
    }
    
    const { avatar } = req.body;
    
    if (sql) {
      await sql`
        UPDATE users 
        SET avatar = ${avatar}
        WHERE discord_id = ${userId}
      `;
    }
    
    console.log(`✅ Аватар пользователя ${userId} обновлён`);
    
    res.json({
      success: true,
      message: 'Аватар успешно обновлён'
    });
    
  } catch (error) {
    console.error('❌ Ошибка обновления аватарки:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Обновление данных пользователя (общий эндпоинт)
app.put('/api/user/:userId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = decodeAuthToken(token);

    const userId = req.params.userId;
    
    // Проверяем, что пользователь обновляет свои данные
    if (decoded.id !== userId) {
      return res.status(403).json({ success: false, error: 'Доступ запрещен' });
    }
    
    const { username, email, avatar } = req.body;
    
    if (sql) {
      const updates = [];
      const values = [];
      
      if (username !== undefined) {
        updates.push(`username = $${values.length + 2}`);
        values.push(username);
      }
      if (email !== undefined) {
        updates.push(`email = $${values.length + 2}`);
        values.push(email);
      }
      if (avatar !== undefined) {
        updates.push(`avatar = $${values.length + 2}`);
        values.push(avatar);
      }
      
      if (updates.length > 0) {
        await sql`
          UPDATE users 
          SET ${sql(updates.join(', '))}
          WHERE discord_id = ${userId}
        `;
      }
    }
    
    console.log(`✅ Данные пользователя ${userId} обновлены`);
    
    res.json({
      success: true,
      message: 'Данные успешно обновлены'
    });
    
  } catch (error) {
    console.error('❌ Ошибка обновления пользователя:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Обновление токена и получение свежих данных из Discord
app.post('/api/auth/discord/refresh', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = decodeAuthToken(token);
    
    if (!decoded) {
      return res.status(401).json({ success: false, error: 'Неверный токен' });
    }
    
    const userId = decoded.id;
    console.log('🔄 Обновление данных пользователя:', userId);
    
    // Получаем свежие данные из Discord API
    try {
      // Нам нужен access_token, но у нас его нет в JWT
      // Вместо этого мы можем сделать запрос к Discord API с существующим токеном?
      // К сожалению, без access_token мы не можем получить свежие данные.
      
      // Альтернатива: используем данные из БД, но аватар может быть устаревшим
      if (sql) {
        const [user] = await sql`
          SELECT discord_id, username, email, avatar, balance, badges
          FROM users 
          WHERE discord_id = ${userId}
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
      
      // Возвращаем данные из токена
      return res.json({
        success: true,
        user: {
          id: decoded.id,
          username: decoded.username,
          avatar: decoded.avatar,
          email: decoded.email
        }
      });
      
    } catch (discordError) {
      console.error('Ошибка получения данных из Discord:', discordError.message);
      
      // Fallback - данные из БД или токена
      if (sql) {
        const [user] = await sql`
          SELECT discord_id, username, email, avatar, balance, badges
          FROM users 
          WHERE discord_id = ${userId}
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
        user: {
          id: decoded.id,
          username: decoded.username,
          avatar: decoded.avatar,
          email: decoded.email
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка обновления токена:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.post('/api/user/:userId/refresh-avatar', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = decodeAuthToken(token);
    
    if (!decoded) {
      return res.status(401).json({ success: false, error: 'Неверный токен' });
    }
    
    const userId = req.params.userId;
    
    if (decoded.id !== userId) {
      return res.status(403).json({ success: false, error: 'Доступ запрещен' });
    }
    
    // Получаем свежие данные пользователя из Discord
    // Для этого нужно, чтобы у пользователя был refresh_token или мы делаем редирект
    // Простой способ: перенаправить пользователя на повторную авторизацию
    
    // Временное решение: возвращаем текущий аватар из БД
    if (sql) {
      const [user] = await sql`
        SELECT avatar FROM users WHERE discord_id = ${userId}
      `;
      
      if (user && user.avatar) {
        return res.json({
          success: true,
          avatar: user.avatar
        });
      }
    }
    
    res.json({
      success: false,
      error: 'Не удалось обновить аватар'
    });
    
  } catch (error) {
    console.error('❌ Ошибка обновления аватара:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Отмена заказа
app.post('/api/orders/:orderId/cancel', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = decodeAuthToken(token);

    const orderId = req.params.orderId;
    const userId = decoded.id;
    
    // Находим заказ пользователя
    let order = null;
    let userOrders = [];
    let userBalance = 0;
    
    if (sql) {
      const [user] = await sql`
        SELECT orders, balance FROM users WHERE discord_id = ${userId}
      `;
      
      if (user) {
        userOrders = user.orders || [];
        userBalance = user.balance || 0;
        order = userOrders.find(o => o.id === orderId);
      }
    }
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Заказ не найден' });
    }
    
    // Проверяем статус заказа (только pending можно отменить)
    if (order.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        error: 'Можно отменить только заказы в статусе "Ожидание"' 
      });
    }
    
    // Возвращаем средства на баланс
    const refundAmount = order.price || order.finalPrice || 0;
    const newBalance = userBalance + refundAmount;
    
    // Обновляем статус заказа
    const updatedOrders = userOrders.map(o => 
      o.id === orderId ? { ...o, status: 'cancelled', cancelledAt: new Date().toISOString() } : o
    );
    
    if (sql) {
      await sql`
        UPDATE users 
        SET orders = ${JSON.stringify(updatedOrders)},
            balance = ${newBalance}
        WHERE discord_id = ${userId}
      `;
    }
    
    console.log(`✅ Заказ ${orderId} отменён пользователем ${userId}, возвращено ${refundAmount}₽`);
    
    res.json({
      success: true,
      message: 'Заказ успешно отменён',
      refundAmount: refundAmount,
      newBalance: newBalance
    });
    
  } catch (error) {
    console.error('❌ Ошибка отмены заказа:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Получение деталей заказа
app.get('/api/orders/:orderId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = decodeAuthToken(token);

    const orderId = req.params.orderId;
    const userId = decoded.id;
    
    let order = null;
    
    if (sql) {
      const [user] = await sql`
        SELECT orders FROM users WHERE discord_id = ${userId}
      `;
      
      if (user) {
        order = (user.orders || []).find(o => o.id === orderId);
      }
    }
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Заказ не найден' });
    }
    
    res.json({
      success: true,
      order: order
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения заказа:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ============================================
// API для настроек приватности и управления аккаунтом
// ============================================

// Сохранение настроек приватности
app.put('/api/user/:userId/privacy', async (req, res) => {
  try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
          return res.status(401).json({ success: false, error: 'Не авторизован' });
      }

      const token = authHeader.replace('Bearer ', '');
      const decoded = decodeAuthToken(token);

      const userId = req.params.userId;
      
      if (decoded.id !== userId) {
          return res.status(403).json({ success: false, error: 'Доступ запрещен' });
      }
      
      const { privacy } = req.body;
      
      if (sql) {
          await sql`
              UPDATE users 
              SET privacy = ${JSON.stringify(privacy)}
              WHERE discord_id = ${userId}
          `;
      }
      
      console.log(`✅ Настройки приватности пользователя ${userId} обновлены`);
      
      res.json({ success: true, message: 'Настройки сохранены' });
      
  } catch (error) {
      console.error('❌ Ошибка сохранения настроек приватности:', error.message);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Заморозка аккаунта
app.post('/api/user/freeze', async (req, res) => {
  try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
          return res.status(401).json({ success: false, error: 'Не авторизован' });
      }

      const token = authHeader.replace('Bearer ', '');
      const decoded = decodeAuthToken(token);

      const { userId } = req.body;
      
      if (decoded.id !== userId) {
          return res.status(403).json({ success: false, error: 'Доступ запрещен' });
      }
      
      if (sql) {
          await sql`
              UPDATE users 
              SET frozen = true
              WHERE discord_id = ${userId}
          `;
      }
      
      console.log(`❄️ Аккаунт ${userId} заморожен`);
      
      res.json({ success: true, message: 'Аккаунт заморожен' });
      
  } catch (error) {
      console.error('❌ Ошибка заморозки аккаунта:', error.message);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Удаление аккаунта
app.delete('/api/user/delete', async (req, res) => {
  try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
          return res.status(401).json({ success: false, error: 'Не авторизован' });
      }

      const token = authHeader.replace('Bearer ', '');
      const decoded = decodeAuthToken(token);

      const { userId } = req.body;
      
      if (decoded.id !== userId) {
          return res.status(403).json({ success: false, error: 'Доступ запрещен' });
      }
      
      if (sql) {
          // Удаляем связанные данные
          await sql`DELETE FROM messages WHERE user_id = ${userId}`;
          await sql`DELETE FROM reviews WHERE user_id = ${userId}`;
          await sql`DELETE FROM notifications WHERE user_id = ${userId}`;
          await sql`DELETE FROM transactions WHERE user_id = ${userId}`;
          await sql`DELETE FROM users WHERE discord_id = ${userId}`;
      }
      
      console.log(`🗑️ Аккаунт ${userId} удалён`);
      
      res.json({ success: true, message: 'Аккаунт удалён' });
      
  } catch (error) {
      console.error('❌ Ошибка удаления аккаунта:', error.message);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ============================================
// Админ маршруты для чата
// ============================================

app.get('/api/admin/chat/users', async (req, res) => {
  try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
          return res.status(401).json({ success: false, error: 'Не авторизован' });
      }

      const token = authHeader.replace('Bearer ', '');
      
      try {
          const decoded = decodeAuthToken(token);

          
          if (!isAdminUser(decoded)) {
              return res.status(403).json({ success: false, error: 'Требуются права администратора' });
          }
          
          const dbUsers = await sql`SELECT * FROM users ORDER BY registered_at DESC`;
          const unreadMessages = await sql`
              SELECT user_id, COUNT(*) as count 
              FROM messages 
              WHERE from_admin = false AND read = false 
              GROUP BY user_id
          `;
          
          const unreadMap = {};
          unreadMessages.forEach(row => {
              unreadMap[row.user_id] = parseInt(row.count);
          });
          
          const users = dbUsers.map(user => ({
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
          
          res.json({
              success: true,
              users: users,
              total: users.length
          });
          
      } catch (decodeError) {
          return res.status(401).json({ success: false, error: 'Неверный токен' });
      }
      
  } catch (error) {
      console.error('❌ Ошибка получения пользователей чата:', error.message);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Получение сообщений пользователя
app.get('/api/chat/messages/:userId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const userId = req.params.userId;
    
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // ✅ ИСПОЛЬЗУЕМ decodeAuthToken
    const decoded = decodeAuthToken(token);
    
    if (!decoded) {
      return res.status(401).json({ success: false, error: 'Неверный токен' });
    }
    
    // Проверяем права доступа (только админ или владелец)
    const isAdmin = decoded.id === '992442453833547886';
    const isOwner = decoded.id === userId;
    
    if (!isAdmin && !isOwner) {
      const [user] = await sql`
        SELECT badges FROM users WHERE discord_id = ${decoded.id}
      `;
      const isAdminFromBadges = user?.badges?.admin === true;
      
      if (!isAdminFromBadges && !isOwner) {
        return res.status(403).json({ success: false, error: 'Доступ запрещен' });
      }
    }
    
    const messages = await sql`
      SELECT * FROM messages 
      WHERE user_id = ${userId} 
      ORDER BY timestamp ASC
      LIMIT 100
    `;
    
    res.json({
      success: true,
      messages: messages || [],
      total: messages?.length || 0
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения сообщений:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Отправка сообщения
app.post('/api/chat/send', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // ✅ ИСПОЛЬЗУЕМ decodeAuthToken
    const decoded = decodeAuthToken(token);
    
    if (!decoded) {
      return res.status(401).json({ success: false, error: 'Неверный токен' });
    }
    
    const { userId, message, fromAdmin } = req.body;
    
    if (!userId || !message) {
      return res.status(400).json({ success: false, error: 'Не указаны данные' });
    }
    
    if (decoded.id !== userId && !fromAdmin) {
      const [user] = await sql`
        SELECT badges FROM users WHERE discord_id = ${decoded.id}
      `;
      
      const isAdmin = user?.badges?.admin === true || decoded.id === '992442453833547886';
      
      if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Доступ запрещен' });
      }
    }
    
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    await sql`
      INSERT INTO messages (id, user_id, message, from_admin, read, timestamp)
      VALUES (
        ${messageId}, 
        ${userId}, 
        ${message}, 
        ${fromAdmin || false}, 
        ${!fromAdmin}, 
        ${now}
      )
    `;
    
    const [user] = await sql`
      SELECT username FROM users WHERE discord_id = ${userId}
    `;
    
    if (!fromAdmin) {
      try {
        const webhookUrl = process.env.DISCORD_WEBHOOK_CHAT || 'https://discord.com/api/webhooks/1518976553856405555/UIJWGhA7I0RdnfoegWoOFazHqRXuEi_mzTSxX0_Bi5Og2OUW3pYi_7iuK_Kz5BY3yM8B';
        
        console.log('Попытка отправки вебхука от пользователя...');
        
        await axios.post(webhookUrl, {
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
        
        console.log('Вебхук отправлен в Discord');
      } catch (webhookError) {
        console.error('Ошибка отправки вебхука:', webhookError.message);
      }
    } else {
      console.log('Сообщение от админа, вебхук не отправляется');
    }
    
    res.json({
      success: true,
      messageId: messageId
    });
    
  } catch (error) {
    console.error('Ошибка отправки сообщения:', error);
    res.status(500).json({ success: false, error: 'Ошибка отправки' });
  }
});

// Проверка новых сообщений
app.post('/api/chat/check', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // ✅ ИСПОЛЬЗУЕМ decodeAuthToken
    const decoded = decodeAuthToken(token);
    
    if (!decoded) {
      return res.status(401).json({ success: false, error: 'Неверный токен' });
    }
    
    const { userId, lastChecked } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Не указан userId' });
    }
    
    // Проверяем права (админ или владелец)
    const isAdmin = decoded.id === '992442453833547886';
    const isOwner = decoded.id === userId;
    
    if (!isAdmin && !isOwner) {
      const [user] = await sql`
        SELECT badges FROM users WHERE discord_id = ${decoded.id}
      `;
      if (!user?.badges?.admin && !isOwner) {
        return res.status(403).json({ success: false, error: 'Доступ запрещен' });
      }
    }
    
    const checkTime = lastChecked ? new Date(parseInt(lastChecked)).toISOString() : new Date(0).toISOString();
    
    const [result] = await sql`
      SELECT COUNT(*) as count FROM messages 
      WHERE user_id = ${userId} 
      AND timestamp > ${checkTime}
    `;
    
    res.json({
      success: true,
      hasNew: parseInt(result?.count || 0) > 0,
      newCount: parseInt(result?.count || 0),
      adminTyping: false
    });
    
  } catch (error) {
    console.error('Ошибка проверки сообщений:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Отметить сообщения как прочитанные
app.post('/api/chat/mark-read/:userId', async (req, res) => {
  try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
          return res.status(401).json({ success: false, error: 'Не авторизован' });
      }

      const token = authHeader.replace('Bearer ', '');
      
      try {
          const decoded = decodeAuthToken(token);

          const userId = req.params.userId;
          
          if (decoded.id !== userId) {
              const [user] = await sql`
                  SELECT badges FROM users WHERE discord_id = ${decoded.id}
              `;
              
              const isAdmin = user?.badges?.admin === true || decoded.id === '992442453833547886';
              
              if (!isAdmin) {
                  return res.status(403).json({ success: false, error: 'Доступ запрещен' });
              }
          }
          
          await sql`
              UPDATE messages 
              SET read = true 
              WHERE user_id = ${userId} 
              AND from_admin = false 
              AND read = false
          `;
          
          res.json({ success: true });
          
      } catch (decodeError) {
          return res.status(401).json({ success: false, error: 'Неверный токен' });
      }
      
  } catch (error) {
      console.error('Ошибка отметки сообщений:', error);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.post('/api/chat/admin/mark-read/:userId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    try {
      const decoded = decodeAuthToken(token);

      
      const userId = req.params.userId;
      
      await sql`
        UPDATE messages 
        SET read = true 
        WHERE user_id = ${userId} 
        AND from_admin = false 
        AND read = false
      `;
      
      res.json({
        success: true,
        message: 'Сообщения отмечены как прочитанные'
      });
      
    } catch (decodeError) {
      return res.status(401).json({ success: false, error: 'Неверный токен' });
    }
    
  } catch (error) {
    console.error('Ошибка отметки сообщений:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.get('/api/chat/admin/check', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    try {
      const decoded = decodeAuthToken(token);

      
      const unreadMessages = await sql`
        SELECT user_id, COUNT(*) as count 
        FROM messages 
        WHERE from_admin = false 
        AND read = false 
        GROUP BY user_id
      `;
      
      const unreadCounts = {};
      let totalUnread = 0;
      
      unreadMessages.forEach(row => {
        unreadCounts[row.user_id] = parseInt(row.count);
        totalUnread += parseInt(row.count);
      });
      
      res.json({
        success: true,
        unreadCounts: unreadCounts,
        totalUnread: totalUnread
      });
      
    } catch (decodeError) {
      return res.status(401).json({ success: false, error: 'Неверный токен' });
    }
    
  } catch (error) {
    console.error('❌ Ошибка проверки сообщений:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ============================================
// Чат маршруты (клиентские)
// ============================================

app.post('/api/chat/typing', async (req, res) => {
  try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
          return res.status(401).json({ success: false, error: 'Не авторизован' });
      }

      const token = authHeader.replace('Bearer ', '');
      
      try {
          const decoded = decodeAuthToken(token);

          const { userId, isTyping, isAdmin } = req.body;
          res.json({ success: true });
          
      } catch (decodeError) {
          return res.status(401).json({ success: false, error: 'Неверный токен' });
      }
      
  } catch (error) {
      console.error('Ошибка обновления статуса печатания:', error);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ============================================
// Маршруты пользователей
// ============================================

// Получение информации о пользователе по ID
// Получение информации о пользователе по ID (с проверкой приватности)
app.get('/api/user/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Определяем, кто запрашивает
    const authHeader = req.headers.authorization;
    let requesterId = null;
    let isOwner = false;
    
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const decoded = decodeAuthToken(token);

        requesterId = decoded.id;
        isOwner = requesterId === userId;
      } catch (e) {}
    }
    
    if (sql) {
      try {
        const [user] = await sql`
          SELECT discord_id, username, email, avatar, registered_at, balance, badges, orders, privacy, frozen 
          FROM users WHERE discord_id = ${userId}
        `;
        
        if (user) {
          const privacy = user.privacy || {
            show_avatar: true,
            show_orders: true,
            show_badges: true,
            show_spent: true,
            show_orders_count: true,
            show_registered: true,
            hide_profile: false
          };
          
          // Если профиль скрыт или заморожен - возвращаем минимум информации (только для владельца)
          if ((privacy.hide_profile === true || user.frozen === true) && !isOwner) {
            return res.json({
              success: true,
              user: {
                discordId: user.discord_id,
                username: null,
                email: null,
                avatar: null,
                registeredAt: null,
                balance: null,
                badges: null,
                orders: null,
                privacy: privacy,
                frozen: user.frozen,
                hidden: true
              }
            });
          }
          
          // Формируем ответ с учетом настроек приватности
          const responseUser = {
            discordId: user.discord_id,
            username: user.username,
            email: isOwner ? (user.email || null) : null,
            registeredAt: user.registered_at,
            balance: isOwner ? (user.balance || 0) : null,
            orders: isOwner ? (user.orders || []) : null,
            badges: isOwner ? (user.badges || {}) : null,
            privacy: privacy,
            frozen: user.frozen || false
          };
          
          // Аватарка - только если разрешено или владелец
          if (isOwner || (privacy.show_avatar !== false && user.avatar)) {
            responseUser.avatar = user.avatar;
          } else {
            responseUser.avatar = null;
          }
          
          // Бейджи - только если разрешено или владелец
          if (!isOwner && privacy.show_badges === false) {
            responseUser.badges = null;
          }
          
          return res.json({
            success: true,
            user: responseUser
          });
        }
      } catch (dbError) {
        console.error('❌ Ошибка БД:', dbError.message);
      }
    }
    
    // Fallback для in-memory
    const user = users[userId];
    if (!user) {
      return res.json({ success: true, user: null });
    }
    
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
    console.error('Ошибка получения пользователя:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Разморозка аккаунта при входе
app.post('/api/user/unfreeze', async (req, res) => {
  try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
          return res.status(401).json({ success: false, error: 'Не авторизован' });
      }

      const token = authHeader.replace('Bearer ', '');
      const decoded = decodeAuthToken(token);

      const { userId } = req.body;
      
      if (decoded.id !== userId) {
          return res.status(403).json({ success: false, error: 'Доступ запрещен' });
      }
      
      if (sql) {
          // Получаем текущие настройки приватности
          const [user] = await sql`
              SELECT privacy FROM users WHERE discord_id = ${userId}
          `;
          
          let currentPrivacy = user?.privacy || {};
          
          // Снимаем заморозку и открываем профиль
          await sql`
              UPDATE users 
              SET frozen = false,
                  privacy = ${JSON.stringify({
                    ...currentPrivacy,
                    hide_profile: false
                  })}
              WHERE discord_id = ${userId}
          `;
      }
      
      console.log(`✅ Аккаунт ${userId} разморожен при входе`);
      
      res.json({ success: true, message: 'Аккаунт разморожен' });
      
  } catch (error) {
      console.error('❌ Ошибка разморозки:', error.message);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Получение баланса пользователя
app.get('/api/user/:id/balance', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Определяем, кто запрашивает
    const authHeader = req.headers.authorization;
    let isOwner = false;
    
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const decoded = decodeAuthToken(token);

        isOwner = decoded.id === userId;
      } catch (e) {}
    }
    
    // Баланс видит только владелец
    if (!isOwner) {
      return res.json({
        success: true,
        balance: null,
        hidden: true,
        currency: 'RUB'
      });
    }
    
    if (sql) {
      try {
        const [user] = await sql`
          SELECT balance FROM users WHERE discord_id = ${userId}
        `;
        
        if (user) {
          return res.json({
            success: true,
            balance: user.balance || 0,
            currency: 'RUB'
          });
        }
      } catch (dbError) {
        console.error('Ошибка БД:', dbError.message);
      }
    }
    
    const user = users[userId];
    
    res.json({
      success: true,
      balance: user?.balance || 0,
      currency: 'RUB'
    });
    
  } catch (error) {
    console.error('Ошибка получения баланса:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка сервера' 
    });
  }
});


app.get('/api/user/:id/orders', async (req, res) => {
  try {
    const userId = req.params.id;
    const { status } = req.query;
    
    // Определяем, кто запрашивает
    const authHeader = req.headers.authorization;
    let requesterId = null;
    let isOwner = false;
    
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const decoded = decodeAuthToken(token);

        requesterId = decoded.id;
        isOwner = requesterId === userId;
      } catch (e) {}
    }
    
    // Если не владелец и профиль скрыт/заморожен - не показываем заказы
    if (!isOwner) {
      const [user] = await sql`
        SELECT privacy, frozen FROM users WHERE discord_id = ${userId}
      `;
      
      if (user) {
        const privacy = user.privacy || {};
        if (privacy.hide_profile === true || user.frozen === true || privacy.show_orders === false) {
          return res.json({ success: true, orders: [] });
        }
      }
    }
    
    let orders = [];
    
    if (sql) {
      const [user] = await sql`
        SELECT orders FROM users WHERE discord_id = ${userId}
      `;
      
      if (user && user.orders) {
        orders = user.orders;
        
        // Для чужих профилей показываем только выполненные заказы
        if (!isOwner) {
          orders = orders.filter(o => o.status === 'completed');
        }
        
        // Фильтрация по статусу
        if (status && status !== 'all') {
          orders = orders.filter(o => o.status === status);
        }
      }
    }
    
    res.json({
      success: true,
      orders: orders || []
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения заказов:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка сервера' 
    });
  }
});

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  
  const token = authHeader.replace('Bearer ', '');
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch(e) {
    return null;
  }
}

// Получение информации о текущем пользователе
app.get('/api/user/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      console.log('❌ /api/user/me - No Authorization header');
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('🔍 /api/user/me - Decoding token...');
    
    const decoded = decodeAuthToken(token);
    
    if (!decoded) {
      console.log('❌ /api/user/me - Invalid token');
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
    
    console.log('✅ /api/user/me - Decoded ID:', decoded.id);
    console.log('✅ /api/user/me - Decoded username:', decoded.username);
    
    // Если нет БД, возвращаем данные из токена
    if (!sql) {
      console.log('⚠️ /api/user/me - No database, returning token data');
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
    
    // Ищем пользователя в БД
    let user = null;
    try {
      const result = await sql`
        SELECT discord_id, username, email, avatar, registered_at, balance, badges, orders, privacy, frozen 
        FROM users WHERE discord_id = ${decoded.id}
      `;
      user = result && result[0];
      console.log('🔍 /api/user/me - Database query result:', user ? 'Found' : 'Not found');
    } catch (dbError) {
      console.error('❌ /api/user/me - Database error:', dbError.message);
    }
    
    // Если пользователь не найден - СОЗДАЁМ!
    if (!user) {
      console.log(`🆕 /api/user/me - Creating new user for ID: ${decoded.id}`);
      
      const username = decoded.username || 'User';
      const email = decoded.email || null;
      const avatar = decoded.avatar || null;
      
      try {
        await sql`
          INSERT INTO users (discord_id, username, email, avatar, balance, badges, orders, frozen, privacy)
          VALUES (
            ${decoded.id}, 
            ${username}, 
            ${email}, 
            ${avatar}, 
            0, 
            '{}', 
            '[]', 
            false,
            '{"show_avatar":true,"show_orders":true,"show_badges":true,"show_spent":true,"show_orders_count":true,"show_registered":true,"hide_profile":false}'
          )
        `;
        console.log(`✅ /api/user/me - User created: ${decoded.id}`);
        
        // Получаем созданного пользователя
        const result = await sql`
          SELECT discord_id, username, email, avatar, registered_at, balance, badges, orders, privacy, frozen 
          FROM users WHERE discord_id = ${decoded.id}
        `;
        user = result && result[0];
      } catch (insertError) {
        console.error('❌ /api/user/me - Insert error:', insertError.message);
      }
    }
    
    if (user) {
      console.log(`✅ /api/user/me - Returning user: ${user.username}, balance: ${user.balance}`);
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
    
    // Если всё else failed - возвращаем данные из токена
    console.log('⚠️ /api/user/me - Returning token data as fallback');
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
    
  } catch (error) {
    console.error('❌ /api/user/me - Fatal error:', error.message);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({ success: false, error: 'Server error: ' + error.message });
  }
});

// ============================================
// Авторизация
// ============================================

// API авторизации
app.post('/api/auth/discord', async (req, res) => {
  try {
    const { code } = req.body;
    console.log('Получен запрос авторизации');
    console.log('Получен code:', code ? 'да' : 'нет');
    console.log('Проверка переменных:');
    console.log('- DISCORD_CLIENT_ID:', DISCORD_CLIENT_ID ? 'установлен' : 'ОТСУТСТВУЕТ');
    console.log('- DISCORD_CLIENT_SECRET:', DISCORD_CLIENT_SECRET ? 'установлен' : 'ОТСУТСТВУЕТ');
    console.log('- DISCORD_REDIRECT_URI:', DISCORD_REDIRECT_URI);

    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
      console.error('Не настроены Discord credentials');
      return res.status(500).json({ 
        success: false, 
        error: 'Сервер не настроен для Discord авторизации' 
      });
    }

    if (!code) {
      return res.status(400).json({ 
        success: false, 
        error: 'Отсутствует код авторизации' 
      });
    }

    const params = new URLSearchParams();
    params.append('client_id', DISCORD_CLIENT_ID);
    params.append('client_secret', DISCORD_CLIENT_SECRET);
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', DISCORD_REDIRECT_URI);
    params.append('scope', 'identify email');

    console.log('Отправка запроса в Discord для получения токена...');
    console.log('URL:', 'https://discord.com/api/oauth2/token');
    
    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    console.log('Токен успешно получен от Discord');

    const { access_token, token_type } = tokenResponse.data;

    console.log('Запрос данных пользователя из Discord...');
    
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        'Authorization': `${token_type} ${access_token}`
      }
    });

    console.log('Данные пользователя получены');

    const userData = {
      id: userResponse.data.id,
      username: userResponse.data.username,
      avatar: userResponse.data.avatar,
      email: userResponse.data.email,
      global_name: userResponse.data.global_name || userResponse.data.username
    };

    console.log(`Пользователь: ${userData.username} (${userData.id})`);
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
      console.log('Пользователь сохранен в памяти');
    }

    if (sql) {
      try {
        const [existingUser] = await sql`
          SELECT * FROM users WHERE discord_id = ${userData.id}
        `;
        
        if (!existingUser) {
          // Новый пользователь - создаём с настройками по умолчанию
          await sql`
            INSERT INTO users (
              discord_id, username, email, avatar, balance, badges, frozen, privacy
            ) VALUES (
              ${userData.id}, 
              ${userData.username}, 
              ${userData.email || ''}, 
              ${userData.avatar}, 
              0,
              ${JSON.stringify({})},
              false,
              ${JSON.stringify({
                show_avatar: true,
                show_orders: true,
                show_badges: true,
                show_spent: true,
                show_orders_count: true,
                show_registered: true,
                hide_profile: false
              })}
            )
          `;
          console.log('Новый пользователь сохранен в БД');
        } else {
          // Существующий пользователь - РАЗМОРАЖИВАЕМ и ОТКРЫВАЕМ ПРОФИЛЬ
          let currentPrivacy = existingUser.privacy || {};
          
          await sql`
            UPDATE users 
            SET username = ${userData.username}, 
                email = ${userData.email || ''}, 
                avatar = ${userData.avatar},
                frozen = false,
                privacy = ${JSON.stringify({
                  ...currentPrivacy,
                  hide_profile: false
                })}
            WHERE discord_id = ${userData.id}
          `;
          console.log(`✅ Пользователь ${userData.id} разморожен и профиль открыт при входе`);
        }
      } catch (dbError) {
        console.error('Ошибка сохранения в БД (используем память):', dbError.message);
      }
    }

    const token = jwt.sign(
      { ...userData },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('Токен для клиента создан');

    res.json({
      success: true,
      token: token,
      user: userData
    });

  } catch (error) {
    console.error('ОШИБКА АВТОРИЗАЦИИ:');
    console.error('- Сообщение:', error.message);
    if (error.response) {
      console.error('- Статус ответа Discord:', error.response.status);
      console.error('- Данные от Discord:', error.response.data);
    }
    console.error('- Полный стек:', error.stack);

    res.status(500).json({ 
      success: false, 
      error: 'Ошибка авторизации через Discord',
      details: error.response?.data || error.message
    });
  }
});

app.get('/auth/discord/callback', (req, res) => {
  const { code, state } = req.query;
  
  console.log('🔗 Discord callback получен!');
  
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
      <title>Авторизация BHStore</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
          body {
              background: linear-gradient(135deg, #1e1f29 0%, #14151a 100%);
              color: white;
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              padding: 20px;
          }
          .container {
              text-align: center;
              padding: 40px;
              background: #2a2b36;
              border-radius: 16px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.4);
              max-width: 500px;
              width: 100%;
          }
          .loader {
              border: 5px solid rgba(255,255,255,0.1);
              border-top: 5px solid #5865F2;
              border-radius: 50%;
              width: 60px;
              height: 60px;
              animation: spin 1s linear infinite;
              margin: 0 auto 20px;
          }
          @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
          }
          h2 {
              margin-bottom: 10px;
              color: #5865F2;
          }
          p {
              color: #b9bbbe;
              margin-bottom: 20px;
          }
          .success {
              color: #57F287;
              font-weight: bold;
          }
      </style>
      <script>
          window.onload = function() {
              const code = '${code || ''}';
              const state = '${state || ''}';
              
              if (!code) {
                  document.getElementById('status').textContent = 'Ошибка: код не получен';
                  return;
              }
              
              if (window.opener && !window.opener.closed) {
                  try {
                      window.opener.postMessage({
                          type: 'DISCORD_AUTH_CALLBACK',
                          code: code,
                          state: state
                      }, '*');
                      
                      document.getElementById('status').className = 'success';
                      document.getElementById('status').textContent = 'Авторизация успешна!';
                      document.getElementById('message').textContent = 'Закрываю окно...';
                      
                      setTimeout(function() {
                          window.close();
                      }, 1000);
                      
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
  </html>
  `;
  
  res.send(html);
});

app.post('/api/send-verification', async (req, res) => {
  try {
    const { userId, code } = req.body;
    console.log(`Отправка кода ${code} пользователю ${userId}`);
    
    const webhookUrl = 'https://discord.com/api/webhooks/1518976627487281364/j7i7z1BTK1Vx2ugRcTK6ufQCVev1IxG0tJ0zbNnJLal4HhfRENGHUe6edyUqvRaND-PR';
    
    await axios.post(webhookUrl, {
      content: `<@${userId}>`,
      embeds: [{
        title: '<:DS:1474931565036441741> Верификация',
        description: `<a:Dot:1386279213278953545> Код - \`${code}\``,
        color: 0x5865F2,
        timestamp: new Date().toISOString()
      }]
    });
    
    console.log('Код отправлен через вебхук');
    
    res.json({ 
      success: true,
      message: 'Код отправлен в Discord'
    });

  } catch (error) {
    console.error('Ошибка отправки кода:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Не удалось отправить код'
    });
  }
});

// Регистрация пользователя
app.post('/api/register', async (req, res) => {
  try {
    const { discordId, username, email, avatar } = req.body;
    console.log(`📝 Регистрация: ${username}`);

    const [existingUser] = await sql`
      SELECT * FROM users WHERE discord_id = ${discordId}
    `;

    if (existingUser) {
      return res.json({ 
        success: true,
        message: 'Пользователь уже зарегистрирован'
      });
    }

    await sql`
      INSERT INTO users (discord_id, username, email, avatar, balance, badges)
      VALUES (
        ${discordId}, 
        ${username}, 
        ${email}, 
        ${avatar}, 
        0,
        ${JSON.stringify({})}
      )
    `;

    res.json({ 
      success: true,
      message: 'Пользователь зарегистрирован'
    });

  } catch (error) {
    console.error('❌ Ошибка регистрации:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка регистрации' 
    });
  }
});

// ============================================
// Заказы
// ============================================

// Приветственное сообщение после верификации
app.post('/api/welcome-message', async (req, res) => {
  try {
      const { userId } = req.body;
      
      const webhookUrl = 'https://discord.com/api/webhooks/1518979592185053385/kGUtr7Kwx2mGXT1o7-PSa_xbhwJT_UKajZq20RwzOEqW6NKjnJHrSjUpn5CnytUM4U6m';
      
      await axios.post(webhookUrl, {
          content: `<@${userId}>`,
          embeds: [{
              title: '<:Wave:1386273780556496967> Добро пожаловать в BHStore!',
              description: 'Вы успешно зарегистрировались в нашем магазине!',
              color: 0x57F287,
              fields: [
                  { name: '🎉 Что дальше?', value: '1. Пополните баланс\n2. Выберите товары в магазине\n3. Наслаждайтесь покупками!', inline: false },
                  { name: '🔗 Полезные ссылки', value: '[Магазин](https://bhstore.netlify.app/shop.html) | [Профиль](https://bhstore.netlify.app/profile.html) | [Поддержка](https://bhstore.netlify.app/profile.html#supportChat)', inline: false }
              ],
              timestamp: new Date().toISOString()
          }]
      });
      
      res.json({ success: true });
  } catch (error) {
      console.error('Ошибка отправки приветствия:', error.message);
      res.json({ success: false });
  }
});

// Создание заказа
app.post('/api/create-order', async (req, res) => {
  try {
    const { userId, productId, productName, price, originalPrice, username, promocodes, discount, discountAmount, orderId: clientOrderId } = req.body;
    
    const orderId = clientOrderId || `BH-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    console.log(`Заказ от ${username || userId}: ${productName}`);
    console.log(`Номер заказа: ${orderId}`);
    console.log(`Цена: ${price} ₽ (оригинал: ${originalPrice || price} ₽)`);
    
    let user = null;
    let userBalance = 0;
    
    if (sql) {
      try {
        const [dbUser] = await sql`
          SELECT * FROM users WHERE discord_id = ${userId}
        `;
        user = dbUser;
        
        if (user) {
          userBalance = user.balance || 0;
        }
      } catch (dbError) {
        console.error('❌ Ошибка получения пользователя из БД:', dbError.message);
      }
    }
    
    if (!user) {
      user = users[userId];
      userBalance = user?.balance || 0;
    }
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'Пользователь не найден' 
      });
    }
    
    const finalPrice = price;
    
    if (userBalance < finalPrice) {
      return res.status(400).json({ 
        success: false, 
        error: 'Недостаточно средств на балансе' 
      });
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
      promocodes: promocodes || [],
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
          SET balance = ${newBalance}, 
              orders = ${JSON.stringify(orders)},
              badges = ${JSON.stringify(badges)}
          WHERE discord_id = ${userId}
        `;
        console.log('Заказ сохранен в БД с номером:', orderId);
      } catch (dbError) {
        console.error('Ошибка сохранения заказа в БД:', dbError.message);
      }
    }

    try {
      const webhookUrl = 'https://discord.com/api/webhooks/1518979354212827406/kPDaqfNL-fKDu8SThdR_WVKh2Buw4JMuABNiQ_M3zJ5AphkZ4gtt_9PI4hsN4b7WjMmR';
      
      const embed = {
        title: '<:Price:1474932616523415583> Новая покупка!',
        description: `<:User:1474931634804359433> <@${userId}> купил "${productName}"
        <:logo1:1486375822049677372><:logo2:1486376008838942880>
        <:logo1:1486375822049677372><:logo2:1486376008838942880>`,
        color: 0x57F287,
        fields: [
          { name: '<:Dot:1474932579328069794> Цена', value: `${finalPrice} ₽`, inline: true },
          { name: '<:Dot:1474932579328069794> Заказ', value: orderId, inline: true },
          { name: '<:Dot:1474932579328069794> Баланс после', value: `${newBalance} ₽`, inline: true }
        ],
        timestamp: new Date().toISOString()
      };
      
      if (discount && discount > 0) {
        embed.fields.unshift({ name: '🏷️ Скидка', value: `${discount}%`, inline: true });
      }
      
      if (promocodes && promocodes.length > 0) {
        embed.fields.unshift({ name: '🎫 Промокоды', value: promocodes.join(', '), inline: true });
      }
      
      await axios.post(webhookUrl, { embeds: [embed] });
      console.log('Уведомление отправлено в Discord с номером заказа:', orderId);
    } catch (webhookError) {
      console.error('Ошибка отправки вебхука:', webhookError.message);
    }

    res.json({
      success: true,
      orderId: orderId,
      newBalance: newBalance
    });

  } catch (error) {
    console.error('Ошибка заказа:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка создания заказа' 
    });
  }
});

// ============================================
// Товары
// ============================================

// Получение товаров из БД
app.get('/api/products', (req, res) => {
  console.log('📦 GET /api/products');
  
  // Возвращаем товары из памяти
  res.json({
    success: true,
    products: productsData,
    total: productsData.length
  });
});

function getTestProducts() {
  return [        {
    "id": "discord_bot_economy",
    "name": "Экономический бот",
    "description": "Экономический бот, который поможет вам умело управлять экономикой!",
    "price": 999,
    "category": "discordbot",
    "icon": "image/emoji/shop_discord.png",
    "features": [
      "ЯП: Python",
      "База данных - JSON или DATABASE",
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
      "ЯП: Python",
      "База данных - JSON или DATABASE",
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
      "ЯП: Python",
      "База данных - JSON или DATABASE",
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
    "features": [
      "Ролик от 5 сек. ДО 3 мин.",
      "Переходы",
      "Соеденинение клипов"
    ]
  },
  {
    "id": "video_montaz_average",
    "name": "Монтаж для видео",
    "description": "Уровень: Average",
    "price": 899,
    "category": "youtube",
    "icon": "image/emoji/montaz.png",
    "features": [
      "Все что в уровне: Easy",
      "Ролик от 5 сек. ДО 10 мин.",
      "Изменение голосов",
      "Специальные эффекты",
      "Звуки"
    ]
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
      "Проффесиональные переходы",
      "Проффесиональные спец.эффекты",
      "Проффесиональные звуки",
      "Проффесиональное изменение голосов",
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
    "features": [
      "Скоро"
    ]
  }
  ];
}

productsData = getTestProducts();
console.log(`✅ Загружено ${productsData.length} тестовых товаров`);

// ============================================
// Новости
// ============================================

// Получение новостей ТОЛЬКО из БД
app.get('/api/news', async (req, res) => {
  try {
    console.log('📰 Запрос новостей из БД...');
    
    if (!sql) {
      console.error('❌ БД не подключена, новости недоступны');
      return res.status(503).json({
        success: false,
        error: 'База данных недоступна',
        news: [],
        total: 0
      });
    }
    
    const news = await sql`
      SELECT * FROM news 
      ORDER BY created_at DESC 
      LIMIT 50
    `;
    
    console.log(`✅ Загружено ${news.length} новостей из БД`);
    
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
    
    res.json({
      success: true,
      news: formattedNews,
      total: formattedNews.length,
      source: 'database'
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения новостей из БД:', error.message);
    res.status(500).json({
      success: false,
      error: 'Ошибка загрузки новостей: ' + error.message,
      news: [],
      total: 0
    });
  }
});

// Получение одной новости по ID (ТОЛЬКО из БД)
app.get('/api/news/:id', async (req, res) => {
  try {
    const newsId = parseInt(req.params.id);
    
    if (isNaN(newsId)) {
      return res.status(400).json({
        success: false,
        error: 'Неверный ID новости'
      });
    }
    
    if (!sql) {
      console.error('❌ БД не подключена');
      return res.status(503).json({
        success: false,
        error: 'База данных недоступна'
      });
    }
    
    const [newsItem] = await sql`
      SELECT * FROM news WHERE id = ${newsId}
    `;
    
    if (!newsItem) {
      return res.status(404).json({
        success: false,
        error: 'Новость не найдена'
      });
    }
    
    // Увеличиваем счётчик просмотров
    await sql`
      UPDATE news 
      SET views = views + 1 
      WHERE id = ${newsId}
    `;
    
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
    console.error('❌ Ошибка получения новости:', error.message);
    res.status(500).json({
      success: false,
      error: 'Ошибка загрузки новости: ' + error.message
    });
  }
});

function getDemoNews() {
  return [
    {
      id: 1,
      title: 'Добро пожаловать в BHStore!',
      content: 'Мы рады приветствовать вас в нашем магазине!',
      date: new Date().toISOString().split('T')[0],
      category: 'announcement',
      author: 'Borisonchik',
      tags: ['welcome', 'new', 'bhstore'],
      image: null,
      created_at: new Date().toISOString()
    }
  ];
}

// ============================================
// УПРАВЛЕНИЕ ЗАКАЗАМИ (FULL CRUD)
// ============================================

app.post('/api/admin/orders/manual', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const token = authHeader.replace('Bearer ', '');
    const decoded = decodeAuthToken(token);

    
    const isAdmin = decoded.id === '992442453833547886';
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Требуются права администратора' });
    }

    const { userId, productName, amount, status, orderId } = req.body;
    
    if (!userId || !productName || !amount) {
      return res.status(400).json({ success: false, error: 'Не все данные заполнены' });
    }
    
    const newOrder = {
      id: orderId || `BH-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      productId: `manual_${Date.now()}`,
      productName: productName,
      price: amount,
      finalPrice: amount,
      originalPrice: amount,
      amount: amount,
      status: status || 'completed',
      date: new Date().toISOString(),
      isManual: true,
      createdAt: new Date().toISOString()
    };
    
    if (!sql) {
      if (!users[userId]) {
        users[userId] = { discordId: userId, orders: [], balance: 0 };
      }
      users[userId].orders = users[userId].orders || [];
      users[userId].orders.push(newOrder);
      return res.json({ success: true, message: 'Заказ создан (in-memory)', order: newOrder });
    }
    
    const [user] = await sql`SELECT * FROM users WHERE discord_id = ${userId}`;
    if (!user) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }
    
    const orders = user.orders || [];
    orders.push(newOrder);
    
    await sql`
      UPDATE users 
      SET orders = ${JSON.stringify(orders)}
      WHERE discord_id = ${userId}
    `;
    
    console.log(`✅ Создан ручной заказ ${newOrder.id} для ${userId}`);
    res.json({ success: true, message: 'Заказ создан', order: newOrder });
    
  } catch (error) {
    console.error('❌ Ошибка создания заказа:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Удалить заказ
app.delete('/api/admin/orders/:orderId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const token = authHeader.replace('Bearer ', '');
    const decoded = decodeAuthToken(token);

    
    const isAdmin = decoded.id === '992442453833547886';
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Требуются права администратора' });
    }

    const orderId = req.params.orderId;
    
    if (!sql) {
      // Удаляем из памяти
      let found = false;
      for (const user of Object.values(users)) {
        const orders = user.orders || [];
        const orderIndex = orders.findIndex(o => o.id === orderId);
        if (orderIndex !== -1) {
          orders.splice(orderIndex, 1);
          found = true;
          break;
        }
      }
      if (!found) return res.status(404).json({ success: false, error: 'Заказ не найден' });
      return res.json({ success: true, message: 'Заказ удалён (in-memory)' });
    }
    
    // Удаляем из БД
    const usersList = await sql`SELECT * FROM users`;
    let found = false;
    
    for (const user of usersList) {
      const orders = user.orders || [];
      const orderIndex = orders.findIndex(o => o.id === orderId);
      if (orderIndex !== -1) {
        orders.splice(orderIndex, 1);
        await sql`
          UPDATE users 
          SET orders = ${JSON.stringify(orders)}
          WHERE discord_id = ${user.discord_id}
        `;
        found = true;
        break;
      }
    }
    
    if (!found) return res.status(404).json({ success: false, error: 'Заказ не найден' });
    
    console.log(`✅ Заказ ${orderId} удалён`);
    res.json({ success: true, message: 'Заказ удалён' });
    
  } catch (error) {
    console.error('❌ Ошибка удаления заказа:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Обновить заказ (полное редактирование)
app.put('/api/admin/orders/:orderId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const token = authHeader.replace('Bearer ', '');
    const decoded = decodeAuthToken(token);

    
    // Проверка админа
    const isAdmin = decoded.id === '992442453833547886';
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Требуются права администратора' });
    }

    const orderId = req.params.orderId;
    const { productName, finalPrice, status, date } = req.body;
    
    if (!sql) {
      // Если нет БД, обновляем в памяти
      let found = false;
      for (const user of Object.values(users)) {
        const orders = user.orders || [];
        const orderIndex = orders.findIndex(o => o.id === orderId);
        if (orderIndex !== -1) {
          if (productName) orders[orderIndex].productName = productName;
          if (finalPrice) orders[orderIndex].price = finalPrice;
          if (finalPrice) orders[orderIndex].finalPrice = finalPrice;
          if (status) orders[orderIndex].status = status;
          if (date) orders[orderIndex].date = date;
          orders[orderIndex].updatedAt = new Date().toISOString();
          found = true;
          break;
        }
      }
      if (!found) return res.status(404).json({ success: false, error: 'Заказ не найден' });
      return res.json({ success: true, message: 'Заказ обновлён (in-memory)' });
    }
    
    // Обновляем в БД
    const usersList = await sql`SELECT * FROM users`;
    let found = false;
    
    for (const user of usersList) {
      const orders = user.orders || [];
      const orderIndex = orders.findIndex(o => o.id === orderId);
      if (orderIndex !== -1) {
        if (productName) orders[orderIndex].productName = productName;
        if (finalPrice) {
          orders[orderIndex].price = finalPrice;
          orders[orderIndex].finalPrice = finalPrice;
        }
        if (status) orders[orderIndex].status = status;
        if (date) orders[orderIndex].date = date;
        orders[orderIndex].updatedAt = new Date().toISOString();
        
        await sql`
          UPDATE users 
          SET orders = ${JSON.stringify(orders)}
          WHERE discord_id = ${user.discord_id}
        `;
        found = true;
        break;
      }
    }
    
    if (!found) return res.status(404).json({ success: false, error: 'Заказ не найден' });
    
    console.log(`✅ Заказ ${orderId} обновлён`);
    res.json({ success: true, message: 'Заказ обновлён' });
    
  } catch (error) {
    console.error('❌ Ошибка обновления заказа:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ============================================
// УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ (FULL CRUD)
// ============================================

// Удалить пользователя
app.delete('/api/admin/users/:userId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const token = authHeader.replace('Bearer ', '');
    const decoded = decodeAuthToken(token);

    
    if (!isAdminUser(decoded)) {
      return res.status(403).json({ success: false, error: 'Требуются права администратора' });
    }

    const userId = req.params.userId;
    
    // Удаляем связанные данные
    await sql`DELETE FROM messages WHERE user_id = ${userId}`;
    await sql`DELETE FROM reviews WHERE user_id = ${userId}`;
    await sql`DELETE FROM notifications WHERE user_id = ${userId}`;
    await sql`DELETE FROM transactions WHERE user_id = ${userId}`;
    await sql`DELETE FROM users WHERE discord_id = ${userId}`;
    
    console.log(`✅ Пользователь ${userId} удалён администратором ${decoded.username}`);
    res.json({ success: true, message: 'Пользователь удалён' });
    
  } catch (error) {
    console.error('❌ Ошибка удаления пользователя:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Обновить пользователя
app.put('/api/admin/users/:userId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const token = authHeader.replace('Bearer ', '');
    const decoded = decodeAuthToken(token);

    
    if (!isAdminUser(decoded)) {
      return res.status(403).json({ success: false, error: 'Требуются права администратора' });
    }

    const userId = req.params.userId;
    const { username, email, balance, badges, avatar } = req.body;
    
    const updateData = {};
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (balance !== undefined) updateData.balance = balance;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (badges !== undefined) updateData.badges = JSON.stringify(badges);
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, error: 'Нет данных для обновления' });
    }
    
    const setClause = Object.entries(updateData)
      .map(([key, value], i) => `${key} = $${i + 2}`)
      .join(', ');
    
    const values = [userId, ...Object.values(updateData)];
    
    await sql`
      UPDATE users 
      SET ${sql(setClause)}
      WHERE discord_id = ${userId}
    `;
    
    console.log(`✅ Пользователь ${userId} обновлён администратором ${decoded.username}`);
    res.json({ success: true, message: 'Пользователь обновлён' });
    
  } catch (error) {
    console.error('❌ Ошибка обновления пользователя:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Назначить/снять бейджи
app.post('/api/admin/users/:userId/badges', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const token = authHeader.replace('Bearer ', '');
    const decoded = decodeAuthToken(token);

    
    if (!isAdminUser(decoded)) {
      return res.status(403).json({ success: false, error: 'Требуются права администратора' });
    }

    const userId = req.params.userId;
    const { badgeKey, value } = req.body;
    
    const [user] = await sql`SELECT badges FROM users WHERE discord_id = ${userId}`;
    if (!user) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }
    
    const badges = user.badges || {};
    badges[badgeKey] = value;
    
    await sql`
      UPDATE users 
      SET badges = ${JSON.stringify(badges)}
      WHERE discord_id = ${userId}
    `;
    
    console.log(`✅ Бейдж ${badgeKey}=${value} для ${userId} администратором ${decoded.username}`);
    res.json({ success: true, message: 'Бейдж обновлён', badges });
    
  } catch (error) {
    console.error('❌ Ошибка обновления бейджа:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ============================================
// Админ маршруты
// ============================================

function isAdminUser(decodedToken) {
  const adminIds = ['992442453833547886'];
  return adminIds.includes(decodedToken.id);
}

app.post('/api/admin/news', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    try {
      const decoded = decodeAuthToken(token);
      
      if (!isAdminUser(decoded)) {
        return res.status(403).json({ success: false, error: 'Требуются права администратора' });
      }
      
      const { title, content, category, date, tags, image } = req.body;
      
      console.log('Создание новости:', { title, content, category, date, tags });
      
      if (!title || !content) {
        return res.status(400).json({ success: false, error: 'Не указаны обязательные поля (title, content)' });
      }
      
      if (sql) {
        try {
          const tableCheck = await sql`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_name = 'news'
            )
          `;
          
          if (!tableCheck[0].exists) {
            await sql`
              CREATE TABLE IF NOT EXISTS news (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                date DATE DEFAULT CURRENT_DATE,
                category TEXT DEFAULT 'announcement',
                views INTEGER DEFAULT 0,
                author TEXT,
                tags JSONB DEFAULT '[]',
                image TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
              )
            `;
            console.log('Таблица news создана');
          }
          
          const result = await sql`
            INSERT INTO news (title, content, date, category, tags, image, author, created_at, updated_at)
            VALUES (
              ${title}, 
              ${content}, 
              ${date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}, 
              ${category || 'announcement'}, 
              ${JSON.stringify(tags || [])}, 
              ${image || null}, 
              ${decoded.username || 'Администратор'},
              NOW(),
              NOW()
            )
            RETURNING id
          `;
          
          console.log(`Новость создана: ${title} (ID: ${result[0].id})`);
          
          try {
            const webhookUrl = 'https://discord.com/api/webhooks/1518979592185053385/kGUtr7Kwx2mGXT1o7-PSa_xbhwJT_UKajZq20RwzOEqW6NKjnJHrSjUpn5CnytUM4U6m';
            
            const categoryNames = {
              'announcement': '📢 Объявление',
              'updates': '🚀 Обновление',
              'events': '🎉 Событие',
              'promo': '🎁 Акция'
            };
            
            await axios.post(webhookUrl, {
              embeds: [{
                title: '<:Wave:1386273780556496967> Новая новость!',
                description: `**${title}**`,
                color: 0x57F287,
                fields: [
                  { name: '📋 Категория', value: categoryNames[category] || category, inline: true },
                  { name: '👤 Автор', value: decoded.username || 'Администратор', inline: true },
                  { name: '📝 Содержание', value: content.substring(0, 200) + (content.length > 200 ? '...' : ''), inline: false }
                ],
                timestamp: new Date().toISOString()
              }]
            }).catch(console.error);
          } catch (webhookError) {
            console.error('Ошибка отправки вебхука:', webhookError.message);
          }
          
          res.json({
            success: true,
            message: 'Новость создана',
            id: result[0].id
          });
          
        } catch (dbError) {
          console.error('Ошибка БД:', dbError.message);
          res.status(500).json({ success: false, error: 'Ошибка базы данных: ' + dbError.message });
        }
      } else {
        const newId = Date.now();
        const demoNews = getDemoNews();
        demoNews.unshift({
          id: newId,
          title: title,
          content: content,
          date: date || new Date().toISOString().split('T')[0],
          category: category || 'announcement',
          views: 0,
          author: decoded.username || 'Администратор',
          tags: tags || [],
          image: image || null,
          created_at: new Date().toISOString()
        });
        
        if (!global.demoNews) global.demoNews = demoNews;
        
        console.log(`Новость создана в памяти: ${title}`);
        
        res.json({
          success: true,
          message: 'Новость создана (демо-режим)',
          id: newId
        });
      }
      
    } catch (decodeError) {
      console.error('Ошибка декодирования токена:', decodeError);
      return res.status(401).json({ success: false, error: 'Неверный токен' });
    }
    
  } catch (error) {
    console.error('Ошибка создания новости:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера: ' + error.message });
  }
});

// Удаление новости (админ)
app.put('/api/admin/news/:id', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    try {
      const decoded = decodeAuthToken(token);

      
      if (!isAdminUser(decoded)) {
        return res.status(403).json({ success: false, error: 'Требуются права администратора' });
      }
      
      const newsId = parseInt(req.params.id);
      const { title, content, category, date, tags, image } = req.body;
      
      if (!title || !content) {
        return res.status(400).json({ success: false, error: 'Не указаны обязательные поля' });
      }
      
      if (sql) {
        await sql`
          UPDATE news 
          SET title = ${title},
              content = ${content},
              date = ${date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]},
              category = ${category || 'announcement'},
              tags = ${JSON.stringify(tags || [])},
              image = ${image || null},
              updated_at = NOW()
          WHERE id = ${newsId}
        `;
        
        console.log(`Новость обновлена: ${newsId}`);
      }
      
      res.json({
        success: true,
        message: 'Новость обновлена'
      });
      
    } catch (decodeError) {
      return res.status(401).json({ success: false, error: 'Неверный токен' });
    }
    
  } catch (error) {
    console.error('Ошибка обновления новости:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.delete('/api/admin/news/:id', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    try {
      const decoded = decodeAuthToken(token);

      
      if (!isAdminUser(decoded)) {
        return res.status(403).json({ success: false, error: 'Требуются права администратора' });
      }
      
      const newsId = parseInt(req.params.id);
      
      if (sql) {
        await sql`
          DELETE FROM news WHERE id = ${newsId}
        `;
        
        console.log(`Новость удалена: ${newsId}`);
      }
      
      res.json({
        success: true,
        message: 'Новость удалена'
      });
      
    } catch (decodeError) {
      return res.status(401).json({ success: false, error: 'Неверный токен' });
    }
    
  } catch (error) {
    console.error('Ошибка удаления новости:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.get('/api/admin/news', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    try {
      const decoded = decodeAuthToken(token);

      
      if (!isAdminUser(decoded)) {
        return res.status(403).json({ success: false, error: 'Требуются права администратора' });
      }
      
      let news = [];
      
      if (sql) {
        news = await sql`
          SELECT * FROM news ORDER BY created_at DESC
        `;
      } else {
        news = getDemoNews();
      }
      
      res.json({
        success: true,
        news: news,
        total: news.length
      });
      
    } catch (decodeError) {
      return res.status(401).json({ success: false, error: 'Неверный токен' });
    }
    
  } catch (error) {
    console.error('Ошибка получения новостей для админки:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Добавление баланса пользователя
app.post('/api/admin/balance/add', async (req, res) => {
  try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
          return res.status(401).json({ success: false, error: 'Не авторизован' });
      }

      const token = authHeader.replace('Bearer ', '');
      
      try {
          const decoded = decodeAuthToken(token);

          
          if (!isAdminUser(decoded)) {
              return res.status(403).json({ success: false, error: 'Требуются права администратора' });
          }
          
          const { userId, amount, reason } = req.body;
          
          if (!userId || !amount) {
              return res.status(400).json({ success: false, error: 'Не указаны userId или amount' });
          }
          
          const [user] = await sql`
              SELECT * FROM users WHERE discord_id = ${userId}
          `;
          
          if (!user) {
              return res.status(404).json({ success: false, error: 'Пользователь не найден' });
          }
          
          const newBalance = (user.balance || 0) + parseInt(amount);
          
          await sql`
              UPDATE users 
              SET balance = ${newBalance}
              WHERE discord_id = ${userId}
          `;
          
          console.log(`Админ ${decoded.username} пополнил баланс ${userId} на ${amount}₽. Причина: ${reason || 'Не указана'}`);
          
          res.json({
              success: true,
              message: `Баланс пополнен на ${amount} ₽`,
              newBalance: newBalance
          });
          
      } catch (decodeError) {
          return res.status(401).json({ success: false, error: 'Неверный токен' });
      }
      
  } catch (error) {
      console.error('Ошибка пополнения баланса:', error.message);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Списание баланса пользователя
app.post('/api/admin/balance/remove', async (req, res) => {
  try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
          return res.status(401).json({ success: false, error: 'Не авторизован' });
      }

      const token = authHeader.replace('Bearer ', '');
      
      try {
          const decoded = decodeAuthToken(token);

          
          if (!isAdminUser(decoded)) {
              return res.status(403).json({ success: false, error: 'Требуются права администратора' });
          }
          
          const { userId, amount, reason } = req.body;
          
          if (!userId || !amount) {
              return res.status(400).json({ success: false, error: 'Не указаны userId или amount' });
          }
          
          const [user] = await sql`
              SELECT * FROM users WHERE discord_id = ${userId}
          `;
          
          if (!user) {
              return res.status(404).json({ success: false, error: 'Пользователь не найден' });
          }
          
          const currentBalance = user.balance || 0;
          const removeAmount = parseInt(amount);
          
          if (currentBalance < removeAmount) {
              return res.status(400).json({ success: false, error: 'Недостаточно средств на балансе' });
          }
          
          const newBalance = currentBalance - removeAmount;
          
          await sql`
              UPDATE users 
              SET balance = ${newBalance}
              WHERE discord_id = ${userId}
          `;
          
          console.log(`Админ ${decoded.username} списал с баланса ${userId} ${removeAmount}₽. Причина: ${reason || 'Не указана'}`);
          
          res.json({
              success: true,
              message: `Списано ${removeAmount} ₽ с баланса`,
              newBalance: newBalance
          });
          
      } catch (decodeError) {
          return res.status(401).json({ success: false, error: 'Неверный токен' });
      }
      
  } catch (error) {
      console.error('Ошибка списания баланса:', error.message);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Установка баланса пользователя
app.post('/api/admin/balance/set', async (req, res) => {
  try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
          return res.status(401).json({ success: false, error: 'Не авторизован' });
      }

      const token = authHeader.replace('Bearer ', '');
      
      try {
          const decoded = decodeAuthToken(token);

          
          if (!isAdminUser(decoded)) {
              return res.status(403).json({ success: false, error: 'Требуются права администратора' });
          }
          
          const { userId, newBalance, reason } = req.body;
          
          if (!userId || newBalance === undefined) {
              return res.status(400).json({ success: false, error: 'Не указаны userId или newBalance' });
          }
          
          const [user] = await sql`
              SELECT * FROM users WHERE discord_id = ${userId}
          `;
          
          if (!user) {
              return res.status(404).json({ success: false, error: 'Пользователь не найден' });
          }
          
          const newBalanceValue = parseInt(newBalance);
          
          if (newBalanceValue < 0) {
              return res.status(400).json({ success: false, error: 'Баланс не может быть отрицательным' });
          }
          
          await sql`
              UPDATE users 
              SET balance = ${newBalanceValue}
              WHERE discord_id = ${userId}
          `;
          
          console.log(`Админ ${decoded.username} установил баланс ${userId} = ${newBalanceValue}₽. Причина: ${reason || 'Не указана'}`);
          
          res.json({
              success: true,
              message: `Баланс установлен на ${newBalanceValue} ₽`,
              newBalance: newBalanceValue
          });
          
      } catch (decodeError) {
          return res.status(401).json({ success: false, error: 'Неверный токен' });
      }
      
  } catch (error) {
      console.error('Ошибка установки баланса:', error.message);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.get('/api/admin/balance-history/:userId', async (req, res) => {
  try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
          return res.status(401).json({ success: false, error: 'Не авторизован' });
      }

      const token = authHeader.replace('Bearer ', '');
      
      try {
          const decoded = decodeAuthToken(token);

          
          if (!isAdminUser(decoded)) {
              return res.status(403).json({ success: false, error: 'Требуются права администратора' });
          }
          
          const userId = req.params.userId;
          
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
          
          res.json({
              success: true,
              transactions: transactions,
              totalDeposits: totalDeposits,
              totalWithdrawals: totalWithdrawals
          });
          
      } catch (decodeError) {
          return res.status(401).json({ success: false, error: 'Неверный токен' });
      }
      
  } catch (error) {
      console.error('Ошибка получения истории баланса:', error.message);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ============================================
// Админ маршруты для заказов
// ============================================

// Получение всех заказов
app.get('/api/admin/orders', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const token = authHeader.replace('Bearer ', '');
    const decoded = decodeAuthToken(token);

    
    const adminIds = ['992442453833547886'];
    let isAdmin = adminIds.includes(decoded.id);
    
    if (!isAdmin && sql) {
      const [user] = await sql`SELECT badges FROM users WHERE discord_id = ${decoded.id}`;
      isAdmin = user?.badges?.admin === true;
    }
    
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Требуются права администратора' });
    }
    
    if (!sql) {
      return res.json({ success: true, orders: [], total: 0 });
    }
    
    const users = await sql`SELECT discord_id, username, avatar, orders FROM users`;
    const allOrders = [];
    
    for (const user of users) {
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
    
    res.json({ success: true, orders: allOrders, total: allOrders.length });
    
  } catch (error) {
    console.error('❌ Ошибка получения заказов:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера: ' + error.message });
  }
});

// Обновление статуса заказа
app.post('/api/admin-update-order', async (req, res) => {
  try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
          return res.status(401).json({ success: false, error: 'Не авторизован' });
      }

      const token = authHeader.replace('Bearer ', '');
      
      try {
          const decoded = decodeAuthToken(token);

          
          if (!isAdminUser(decoded)) {
              return res.status(403).json({ success: false, error: 'Требуются права администратора' });
          }
          
          const { orderId, status } = req.body;
          
          if (!orderId || !status) {
              return res.status(400).json({ success: false, error: 'Не указаны orderId или status' });
          }
          
          console.log(`Админ ${decoded.username} обновил статус заказа ${orderId} на ${status}`);
          
          res.json({
              success: true,
              message: 'Статус заказа обновлен'
          });
          
      } catch (decodeError) {
          return res.status(401).json({ success: false, error: 'Неверный токен' });
      }
      
  } catch (error) {
      console.error('Ошибка обновления заказа:', error.message);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ============================================
// Админ маршруты для товаров
// ============================================

// Создание товара
app.post('/api/admin/products', async (req, res) => {
  try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
          return res.status(401).json({ success: false, error: 'Не авторизован' });
      }

      const token = authHeader.replace('Bearer ', '');
      
      try {
          const decoded = decodeAuthToken(token);

          
          if (!isAdminUser(decoded)) {
              return res.status(403).json({ success: false, error: 'Требуются права администратора' });
          }
          
          const productData = req.body;
          
          if (!productData.name || !productData.price) {
              return res.status(400).json({ success: false, error: 'Не указаны обязательные поля' });
          }
          
          if (!productData.id) {
              productData.id = 'prod_' + Date.now();
          }
          
          await sql`
              INSERT INTO products (
                  id, name, description, price, category, icon, image, features, popular, discount
              ) VALUES (
                  ${productData.id},
                  ${productData.name},
                  ${productData.description || ''},
                  ${productData.price},
                  ${productData.category || 'other'},
                  ${productData.icon || 'fas fa-box'},
                  ${productData.image || ''},
                  ${JSON.stringify(productData.features || [])},
                  ${productData.popular || false},
                  ${productData.discount || 0}
              )
              ON CONFLICT (id) DO UPDATE SET
                  name = EXCLUDED.name,
                  description = EXCLUDED.description,
                  price = EXCLUDED.price,
                  category = EXCLUDED.category,
                  icon = EXCLUDED.icon,
                  image = EXCLUDED.image,
                  features = EXCLUDED.features,
                  popular = EXCLUDED.popular,
                  discount = EXCLUDED.discount
          `;
          
          console.log(`Админ ${decoded.username} создал товар: ${productData.name}`);
          
          res.json({
              success: true,
              message: 'Товар создан',
              product: productData
          });
          
      } catch (decodeError) {
          return res.status(401).json({ success: false, error: 'Неверный токен' });
      }
      
  } catch (error) {
      console.error('Ошибка создания товара:', error.message);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Получение товара по ID
app.get('/api/admin/products/:id', async (req, res) => {
  try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
          return res.status(401).json({ success: false, error: 'Не авторизован' });
      }

      const token = authHeader.replace('Bearer ', '');
      
      try {
          const decoded = decodeAuthToken(token);

          
          if (!isAdminUser(decoded)) {
              return res.status(403).json({ success: false, error: 'Требуются права администратора' });
          }
          
          const productId = req.params.id;
          
          const [product] = await sql`
              SELECT * FROM products WHERE id = ${productId}
          `;
          
          if (!product) {
              return res.status(404).json({ success: false, error: 'Товар не найден' });
          }
          
          res.json({
              success: true,
              product: product
          });
          
      } catch (decodeError) {
          return res.status(401).json({ success: false, error: 'Неверный токен' });
      }
      
  } catch (error) {
      console.error('Ошибка получения товара:', error.message);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Обновление товара
app.put('/api/admin/products/:id', async (req, res) => {
  try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
          return res.status(401).json({ success: false, error: 'Не авторизован' });
      }

      const token = authHeader.replace('Bearer ', '');
      
      try {
          const decoded = decodeAuthToken(token);

          
          if (!isAdminUser(decoded)) {
              return res.status(403).json({ success: false, error: 'Требуются права администратора' });
          }
          
          const productId = req.params.id;
          const productData = req.body;
          
          await sql`
              UPDATE products 
              SET name = ${productData.name},
                  description = ${productData.description || ''},
                  price = ${productData.price},
                  category = ${productData.category || 'other'},
                  icon = ${productData.icon || 'fas fa-box'},
                  image = ${productData.image || ''},
                  features = ${JSON.stringify(productData.features || [])},
                  popular = ${productData.popular || false},
                  discount = ${productData.discount || 0}
              WHERE id = ${productId}
          `;
          
          console.log(`Админ ${decoded.username} обновил товар: ${productId}`);
          
          res.json({
              success: true,
              message: 'Товар обновлен'
          });
          
      } catch (decodeError) {
          return res.status(401).json({ success: false, error: 'Неверный токен' });
      }
      
  } catch (error) {
      console.error('Ошибка обновления товара:', error.message);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Удаление товара
app.delete('/api/admin/products/:id', async (req, res) => {
  try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
          return res.status(401).json({ success: false, error: 'Не авторизован' });
      }

      const token = authHeader.replace('Bearer ', '');
      
      try {
          const decoded = decodeAuthToken(token);

          
          if (!isAdminUser(decoded)) {
              return res.status(403).json({ success: false, error: 'Требуются права администратора' });
          }
          
          const productId = req.params.id;
          
          await sql`
              DELETE FROM products WHERE id = ${productId}
          `;
          
          console.log(`Админ ${decoded.username} удалил товар: ${productId}`);
          
          res.json({
              success: true,
              message: 'Товар удален'
          });
          
      } catch (decodeError) {
          return res.status(401).json({ success: false, error: 'Неверный токен' });
      }
      
  } catch (error) {
      console.error('Ошибка удаления товара:', error.message);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const token = authHeader.replace('Bearer ', '');
    const decoded = decodeAuthToken(token);

    
    const adminIds = ['992442453833547886'];
    let isAdmin = adminIds.includes(decoded.id);
    
    if (!isAdmin && sql) {
      const [user] = await sql`SELECT badges FROM users WHERE discord_id = ${decoded.id}`;
      isAdmin = user?.badges?.admin === true;
    }
    
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Требуются права администратора' });
    }
    
    if (!sql) {
      return res.json({ success: true, users: [], total: 0 });
    }
    
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
    console.error('❌ Ошибка получения пользователей:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Проверка прав администратора
app.get('/api/admin/check', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.json({ isAdmin: false });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // ✅ ИСПОЛЬЗУЕМ decodeAuthToken
    const decoded = decodeAuthToken(token);
    
    if (decoded && decoded.id === '992442453833547886') {
      console.log('Hardcoded admin access');
      return res.json({ isAdmin: true });
    }
    
    if (decoded && sql) {
      const [user] = await sql`
        SELECT badges FROM users WHERE discord_id = ${decoded.id}
      `;
      
      if (user?.badges?.admin) {
        return res.json({ isAdmin: true });
      }
    }
    
    res.json({ isAdmin: false });
    
  } catch (error) {
    console.error('Ошибка проверки админа:', error);
    res.json({ isAdmin: false });
  }
});

app.get('/api/admin/stats', async (req, res) => {
  try {
    const [userStats] = await sql`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN registered_at > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) as new_users
      FROM users
    `;
    
    const users = await sql`SELECT orders FROM users`;
    
    let totalOrders = 0;
    let totalRevenue = 0;
    let newOrders = 0;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    users.forEach(user => {
      const orders = user.orders || [];
      totalOrders += orders.length;
      
      orders.forEach(order => {
        totalRevenue += order.price || 0;
        if (new Date(order.date) > weekAgo) {
          newOrders++;
        }
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
    console.error('Ошибка получения статистики:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ============================================
// API для промокодов
// ============================================

// Проверка промокода
app.post('/api/promocodes/check', async (req, res) => {
  try {
    const { userId, code } = req.body;
    
    console.log(`🔍 Проверка промокода:`, { userId, code });
    
    if (!userId || !code) {
      return res.status(400).json({ 
        success: false, 
        error: 'Не указаны userId или code' 
      });
    }
    
    const codeUpper = code.toUpperCase();
    const now = new Date();
    
    let promocode = null;
    
    if (sql) {
      const [result] = await sql`
        SELECT * FROM promocodes 
        WHERE UPPER(code) = ${codeUpper}
      `;
      promocode = result;
      console.log(`📊 Результат поиска:`, promocode ? `найден ${promocode.code}` : 'не найден');
    }
    
    if (!promocode) {
      return res.status(404).json({ 
        success: false, 
        error: '🔍 Промокод не найден' 
      });
    }
    
    // Проверка активности
    if (!promocode.active) {
      return res.status(400).json({ 
        success: false, 
        error: '❌ Промокод неактивен' 
      });
    }
    
    // Проверка общего лимита использований
    if (promocode.max_uses && promocode.used_count >= promocode.max_uses) {
      return res.status(400).json({ 
        success: false, 
        error: `❌ Промокод больше недействителен (достигнут общий лимит: ${promocode.used_count}/${promocode.max_uses})`,
        reason: 'expired'
      });
    }
    
    // Проверка лимита использований на пользователя
    const usedBy = promocode.used_by || [];
    const userUseCount = usedBy.filter(id => id === userId).length;
    const maxPerUser = promocode.max_uses_per_user || 1;
    
    if (userUseCount >= maxPerUser) {
      return res.status(400).json({ 
        success: false, 
        error: `⚠️ Вы уже использовали этот промокод ${userUseCount} раз(а). Максимум: ${maxPerUser}`,
        reason: 'already_used'
      });
    }
    
    // Проверка периода действия
    if (promocode.valid_from) {
      const validFrom = new Date(promocode.valid_from);
      if (now < validFrom) {
        const startDate = validFrom.toLocaleDateString('ru-RU');
        return res.status(400).json({ 
          success: false, 
          error: `📅 Промокод начнет действовать с ${startDate}`,
          reason: 'not_started'
        });
      }
    }
    
    if (promocode.valid_until) {
      const validUntil = new Date(promocode.valid_until);
      if (now > validUntil) {
        const endDate = validUntil.toLocaleDateString('ru-RU');
        return res.status(400).json({ 
          success: false, 
          error: `⏰ Промокод истек ${endDate}`,
          reason: 'expired'
        });
      }
    }
    
    console.log(`✅ Промокод ${promocode.code} найден, тип: ${promocode.type}, значение: ${promocode.value}`);
    
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
    console.error('❌ Ошибка проверки промокода:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка сервера: ' + error.message 
    });
  }
});

// Активация промокода
app.post('/api/promocodes/activate', async (req, res) => {
  try {
    const { userId, code } = req.body;
    
    if (!userId || !code) {
      return res.status(400).json({ 
        success: false, 
        error: 'Не указаны данные' 
      });
    }
    
    const codeUpper = code.toUpperCase();
    const now = new Date();
    console.log(`🎫 Активация промокода: ${codeUpper} для пользователя ${userId}`);
    
    let promocode = null;
    
    if (sql) {
      const [result] = await sql`
        SELECT * FROM promocodes 
        WHERE UPPER(code) = ${codeUpper}
      `;
      promocode = result;
      console.log(`📊 Найден промокод:`, promocode ? `${promocode.code} тип: ${promocode.type}` : 'не найден');
    }
    
    if (!promocode) {
      return res.status(404).json({ 
        success: false, 
        error: 'Промокод не найден' 
      });
    }
    
    if (!promocode.active) {
      return res.status(400).json({ 
        success: false, 
        error: '❌ Промокод неактивен' 
      });
    }
    
    // Проверка общего лимита использований
    if (promocode.max_uses && promocode.used_count >= promocode.max_uses) {
      return res.status(400).json({ 
        success: false, 
        error: `❌ Промокод больше недействителен (достигнут общий лимит: ${promocode.used_count}/${promocode.max_uses})` 
      });
    }
    
    // Проверка лимита использований на пользователя
    let usedBy = promocode.used_by || [];
    const userUseCount = usedBy.filter(id => id === userId).length;
    const maxPerUser = promocode.max_uses_per_user || 1;
    
    if (userUseCount >= maxPerUser) {
      return res.status(400).json({ 
        success: false, 
        error: `❌ Вы уже использовали этот промокод ${userUseCount} раз(а). Максимум: ${maxPerUser}`
      });
    }
    
    // Проверка периода действия
    if (promocode.valid_from) {
      const validFrom = new Date(promocode.valid_from);
      if (now < validFrom) {
        const startDate = validFrom.toLocaleDateString('ru-RU');
        return res.status(400).json({ 
          success: false, 
          error: `📅 Промокод начнет действовать с ${startDate}`
        });
      }
    }
    
    if (promocode.valid_until) {
      const validUntil = new Date(promocode.valid_until);
      if (now > validUntil) {
        const endDate = validUntil.toLocaleDateString('ru-RU');
        return res.status(400).json({ 
          success: false, 
          error: `⏰ Период действия промокода истек ${endDate}`
        });
      }
    }
    
    // ===== ОБНОВЛЯЕМ ПРОМОКОД (ДОБАВЛЯЕМ userId В used_by) =====
    usedBy.push(userId);
    const newUsedCount = (promocode.used_count || 0) + 1;
    
    if (sql) {
      await sql`
        UPDATE promocodes 
        SET used_count = ${newUsedCount}, 
            used_by = ${JSON.stringify(usedBy)},
            updated_at = NOW()
        WHERE code = ${promocode.code}
      `;
      console.log(`📊 Обновлена статистика: использован ${newUsedCount} раз(а) из ${promocode.max_uses || '∞'}, used_by: ${JSON.stringify(usedBy)}`);
    }
    
    let newBalance = null;
    let expiresAt = null;
    
    const promoType = String(promocode.type).toLowerCase();
    
    // ДЛЯ БАЛАНСОВЫХ ПРОМОКОДОВ
    if (promoType === 'balance') {
      console.log(`💰 Балансовый промокод: начисляем ${promocode.value} ₽`);
      
      if (sql) {
        const [user] = await sql`
          SELECT balance FROM users WHERE discord_id = ${userId}
        `;
        
        if (user) {
          newBalance = (user.balance || 0) + promocode.value;
          await sql`
            UPDATE users 
            SET balance = ${newBalance}
            WHERE discord_id = ${userId}
          `;
          console.log(`✅ Баланс обновлен: ${userId} -> ${newBalance} ₽`);
        }
      }
      
      return res.json({
        success: true,
        message: `💰 Баланс пополнен на ${promocode.value} ₽`,
        newBalance: newBalance,
        value: promocode.value,
        type: 'balance',
        code: promocode.code,
        used_at: now.toISOString()
      });
    }
    
    // ДЛЯ СКИДОЧНЫХ ПРОМОКОДОВ
    else if (promoType === 'discount') {
      console.log(`🏷️ Скидочный промокод: скидка ${promocode.value}%`);
      
      if (promocode.valid_days && promocode.valid_days > 0) {
        expiresAt = new Date(now);
        expiresAt.setDate(expiresAt.getDate() + promocode.valid_days);
        console.log(`⏰ Действует до: ${expiresAt.toISOString()}`);
      }
      
      return res.json({
        success: true,
        message: `✓ Промокод "${promocode.code}" активирован! Скидка ${promocode.value}%`,
        newBalance: null,
        value: promocode.value,
        type: 'discount',
        code: promocode.code,
        expires_at: expiresAt,
        valid_days: promocode.valid_days,
        used_at: now.toISOString()
      });
    }
    
    else {
      return res.status(400).json({
        success: false,
        error: `❌ Неизвестный тип промокода: ${promocode.type}`
      });
    }
    
  } catch (error) {
    console.error('Ошибка активации промокода:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка активации промокода: ' + error.message 
    });
  }
});

// Получить активные промокоды пользователя
app.get('/api/promocodes/active/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const now = new Date();
    
    let activePromocodes = [];
    
    if (sql) {
      // Получаем все промокоды, которые использовал пользователь
      const userPromocodes = await sql`
        SELECT * FROM promocodes 
        WHERE used_by ? ${userId}
      `;
      
      // Фильтруем только скидочные промокоды, которые не истекли
      activePromocodes = userPromocodes
        .filter(promo => {
          if (promo.type !== 'discount') return false;
          
          // Проверяем дату истечения
          if (promo.valid_days && promo.valid_days > 0) {
            const usedAt = promo.updated_at;
            const expiresAt = new Date(usedAt);
            expiresAt.setDate(expiresAt.getDate() + promo.valid_days);
            return new Date() <= expiresAt;
          }
          
          // Проверяем период действия
          if (promo.valid_until) {
            return new Date() <= new Date(promo.valid_until);
          }
          
          return true;
        })
        .map(promo => ({
          code: promo.code,
          value: promo.value,
          type: 'discount',
          appliedAt: promo.updated_at,
          expires_at: promo.valid_days ? 
            new Date(new Date(promo.updated_at).getTime() + promo.valid_days * 24 * 60 * 60 * 1000) : 
            promo.valid_until,
          product_ids: promo.product_ids || []
        }));
    }
    
    res.json({
      success: true,
      promocodes: activePromocodes
    });
    
  } catch (error) {
    console.error('Ошибка получения активных промокодов:', error.message);
    res.json({ success: true, promocodes: [] });
  }
});

// Сохранить активные промокоды
app.post('/api/promocodes/save-active', async (req, res) => {
  try {
      const { userId, activeDiscounts } = req.body;
      
      await sql`
          UPDATE users 
          SET active_promocodes = ${JSON.stringify(activeDiscounts)}
          WHERE discord_id = ${userId}
      `;
      
      res.json({ success: true });
  } catch (error) {
      res.json({ success: false });
  }
});

// Удалить активный промокод
app.post('/api/promocodes/remove-active', async (req, res) => {
  try {
      const { userId, code } = req.body;
      
      const [user] = await sql`
          SELECT active_promocodes FROM users WHERE discord_id = ${userId}
      `;
      
      const activePromocodes = (user?.active_promocodes || []).filter(p => p.code !== code);
      
      await sql`
          UPDATE users 
          SET active_promocodes = ${JSON.stringify(activePromocodes)}
          WHERE discord_id = ${userId}
      `;
      
      res.json({ success: true });
  } catch (error) {
      res.json({ success: false });
  }
});

// История промокодов пользователя
app.get('/api/promocodes/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    let promocodes = [];
    
    if (sql) {
      promocodes = await sql`
        SELECT 
          code, 
          type, 
          value, 
          used_count,
          used_by,
          valid_from,
          valid_until,
          valid_days,
          max_uses,
          max_uses_per_user,
          created_at,
          updated_at
        FROM promocodes 
        WHERE used_by ? ${userId}
        ORDER BY updated_at DESC
      `;
    }
    
    const formattedPromocodes = promocodes.map(promo => {
      const usedByList = promo.used_by || [];
      const usedAt = usedByList.includes(userId) ? promo.updated_at : promo.created_at;
      
      return {
        code: promo.code,
        type: promo.type,
        value: promo.value,
        usedAt: usedAt,
        usedAtFormatted: usedAt ? new Date(usedAt).toLocaleString('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : 'Дата неизвестна',
        valid_from: promo.valid_from,
        valid_until: promo.valid_until,
        valid_days: promo.valid_days,
        max_uses: promo.max_uses,
        max_uses_per_user: promo.max_uses_per_user || 1
      };
    });
    
    console.log(`📜 Загружено ${formattedPromocodes.length} промокодов для ${userId}`);
    
    res.json({
      success: true,
      promocodes: formattedPromocodes,
      total: formattedPromocodes.length
    });
    
  } catch (error) {
    console.error('Ошибка получения истории промокодов:', error.message);
    res.json({ 
      success: true, 
      promocodes: [],
      total: 0
    });
  }
});

// ============================================
// API для отзывов
// ============================================

// GET /api/reviews - получение всех отзывов
app.get('/api/reviews', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const offset = (page - 1) * limit;
    
    const reviews = await sql`
      SELECT * FROM reviews 
      ORDER BY created_at DESC 
      LIMIT ${parseInt(limit)} 
      OFFSET ${offset}
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
      reviews: reviews,
      stats: {
        totalReviews: parseInt(stats.total_reviews) || 0,
        averageRating: parseFloat(stats.avg_rating) || 0,
        verifiedPurchases: parseInt(stats.verified_purchases) || 0,
        totalHelpful: parseInt(stats.total_helpful) || 0
      },
      pagination: {
        total: parseInt(stats.total_reviews) || 0,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil((parseInt(stats.total_reviews) || 0) / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Ошибка получения отзывов:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка загрузки отзывов' 
    });
  }
});

// POST /api/reviews - создание нового отзыва
app.post('/api/reviews', async (req, res) => {
  try {
    const { userId, name, productId, productName, rating, text } = req.body;
    
    console.log('Получен запрос на создание отзыва:', { userId, name, productId, productName, rating });
    
    if (!userId || !name || !productId || !productName || !rating || !text) {
      return res.status(400).json({
        success: false,
        error: 'Заполните все обязательные поля'
      });
    }
    
    if (text.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Отзыв должен содержать минимум 10 символов'
      });
    }
    
    const [user] = await sql`
      SELECT * FROM users WHERE discord_id = ${userId}
    `;
    
    const avatar = user?.avatar 
      ? `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/0.png`;
    
    const orders = user?.orders || [];
    const hasPurchased = orders.some(order => 
      order.productName === productName || order.productId === productId
    ) || false;
    
    const reviewId = `rev_${Date.now()}`;
    const now = new Date().toISOString();
    
    await sql`
      INSERT INTO reviews (
        id, user_id, name, avatar, rating, product_id, 
        product_name, text, verified_purchase, verified, 
        helpful, created_at, updated_at
      ) VALUES (
        ${reviewId}, ${userId}, ${name}, ${avatar}, ${parseInt(rating)}, 
        ${productId}, ${productName}, ${text}, ${hasPurchased}, 
        ${user?.badges?.verified || false}, 0, ${now}, ${now}
      )
    `;
    
    console.log(`Отзыв создан: ${reviewId} от ${name}`);
    const webhookUrl = 'https://discord.com/api/webhooks/1518976761172594809/a5ImszXDt-RMJhUZB5DE2vNQfiyCr84mbozXShnujpKGMz3Lvnmgf02IOl3WpQsSWf45';
    
    axios.post(webhookUrl, {
      embeds: [{
        title: '<:Wave:1386273780556496967> Новый отзыв!',
        description: `**${name}** оставил отзыв на товар **${productName}**`,
        color: 0xFEE75C,
        fields: [
          { name: '<a:Dot:1386279213278953545> Оценка', value: '<:Premium:1474931599622803628>'.repeat(parseInt(rating)), inline: true },
          { name: '<a:Dot:1386279213278953545> Текст', value: text.substring(0, 100) + (text.length > 100 ? '...' : ''), inline: false }
        ],
        timestamp: now
      }]
    }).catch(console.error);
    
    res.json({
      success: true,
      message: 'Отзыв успешно добавлен',
      review: {
        id: reviewId,
        userId,
        name,
        avatar,
        rating: parseInt(rating),
        productId,
        productName,
        text,
        verifiedPurchase: hasPurchased,
        verified: user?.badges?.verified || false,
        helpful: 0,
        createdAt: now
      }
    });
    
  } catch (error) {
    console.error('Ошибка создания отзыва:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка при создании отзыва' 
    });
  }
});

// POST /api/reviews/:id/helpful - отметка "полезно"
app.post('/api/reviews/:id/helpful', async (req, res) => {
  try {
    const reviewId = req.params.id;
    
    await sql`
      UPDATE reviews 
      SET helpful = helpful + 1 
      WHERE id = ${reviewId}
    `;
    
    const [updated] = await sql`
      SELECT helpful FROM reviews WHERE id = ${reviewId}
    `;
    
    res.json({
      success: true,
      message: 'Спасибо за оценку!',
      helpful: updated?.helpful || 0
    });
    
  } catch (error) {
    console.error('Ошибка отметки "полезно":', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка при отметке' 
    });
  }
});

// ============================================
// API для уведомлений
// ============================================

// Получение уведомлений пользователя
app.get('/api/notifications/user/:userId', async (req, res) => {
  try {
      const userId = req.params.userId;
      
      const notifications = await sql`
          SELECT * FROM notifications 
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          LIMIT 50
      `;
      
      res.json({
          success: true,
          notifications: notifications
      });
  } catch (error) {
      console.error('Ошибка получения уведомлений:', error);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Отметить уведомление как прочитанное
app.post('/api/notifications/:id/read', async (req, res) => {
  try {
      const notificationId = req.params.id;
      
      await sql`
          UPDATE notifications 
          SET read = true 
          WHERE id = ${notificationId}
      `;
      
      res.json({ success: true });
  } catch (error) {
      console.error('Ошибка отметки уведомления:', error);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Сохранение уведомления о покупке
app.post('/api/notifications/purchase', async (req, res) => {
  try {
      const { userId, productName, amount, orderId } = req.body;
      
      const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await sql`
          INSERT INTO notifications (id, user_id, type, title, message, data, created_at)
          VALUES (
              ${notificationId},
              ${userId},
              'purchase',
              'Новая покупка',
              ${`Вы купили ${productName} за ${amount} ₽`},
              ${JSON.stringify({ productName, amount, orderId })},
              ${new Date().toISOString()}
          )
      `;
      
      res.json({ success: true });
  } catch (error) {
      console.error('Ошибка сохранения уведомления:', error);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Сохранение уведомления о регистрации
app.post('/api/notifications/registration', async (req, res) => {
  try {
      const { userId, username } = req.body;
      
      const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await sql`
          INSERT INTO notifications (id, user_id, type, title, message, data, created_at)
          VALUES (
              ${notificationId},
              ${userId},
              'registration',
              'Добро пожаловать!',
              ${`${username}, вы успешно зарегистрировались в BHStore`},
              ${JSON.stringify({ username })},
              ${new Date().toISOString()}
          )
      `;
      
      res.json({ success: true });
  } catch (error) {
      console.error('Ошибка сохранения уведомления:', error);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Сохранение ошибки
app.post('/api/notifications/error', async (req, res) => {
  try {
      const { errorType, errorMessage, userId, userAgent, url } = req.body;
      
      const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await sql`
          INSERT INTO errors (id, type, message, user_id, user_agent, url, created_at)
          VALUES (
              ${errorId},
              ${errorType},
              ${errorMessage},
              ${userId || null},
              ${userAgent},
              ${url},
              ${new Date().toISOString()}
          )
      `;
      
      res.json({ success: true });
  } catch (error) {
      console.error('Ошибка сохранения ошибки:', error);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Сохранение статистики
app.post('/api/stats/save', async (req, res) => {
  try {
      const stats = req.body;
      
      await sql`
          INSERT INTO stats (data, created_at)
          VALUES (
              ${JSON.stringify(stats)},
              ${new Date().toISOString()}
          )
      `;
      
      res.json({ success: true });
  } catch (error) {
      console.error('Ошибка сохранения статистики:', error);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Отправка вебхука (безопасно, с сервера)
app.post('/api/webhook/send', async (req, res) => {
  try {
      const { title, description, color, fields } = req.body;
      
      const webhookUrl = process.env.DISCORD_WEBHOOK_CHAT || 'https://discord.com/api/webhooks/1518976553856405555/UIJWGhA7I0RdnfoegWoOFazHqRXuEi_mzTSxX0_Bi5Og2OUW3pYi_7iuK_Kz5BY3yM8B';
      
      const response = await axios.post(webhookUrl, {
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
      console.error('Ошибка отправки вебхука:', error.message);
      res.status(500).json({ success: false, error: 'Ошибка отправки' });
  }
});

// ============================================
// Обновление баланса
// ============================================

app.post('/api/update-balance', async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;
    
    if (!userId || !amount) {
      return res.status(400).json({ 
        success: false, 
        error: 'Не указаны userId или amount' 
      });
    }
    
    const [user] = await sql`
      SELECT * FROM users WHERE discord_id = ${userId}
    `;
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'Пользователь не найден' 
      });
    }
    
    if (amount < 0 && (user.balance || 0) < Math.abs(amount)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Недостаточно средств на балансе' 
      });
    }
    
    const newBalance = (user.balance || 0) + parseFloat(amount);
    
    await sql`
      UPDATE users 
      SET balance = ${newBalance}
      WHERE discord_id = ${userId}
    `;
    
    console.log(`Баланс обновлен: ${userId} ${amount > 0 ? '+' : ''}${amount} ₽ = ${newBalance} ₽`);
    
    res.json({
      success: true,
      message: 'Баланс обновлен',
      newBalance: newBalance
    });
    
  } catch (error) {
    console.error('Ошибка обновления баланса:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка обновления баланса' 
    });
  }
});

// ============================================
// Тестовый маршрут
// ============================================

app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Сервер работает',
    stats: {
      users: Object.keys(users).length,
      chatSessions: Object.keys(chatStore).length,
      totalMessages: Object.values(chatStore).reduce((sum, msgs) => sum + msgs.length, 0),
      reviews: reviewsData.reviews?.length || 0,
      promocodes: Object.keys(promocodes).length
    }
  });
});

module.exports.handler = serverless(app);
