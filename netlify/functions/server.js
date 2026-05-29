const express = require('express');
const axios = require('axios');
const cors = require('cors');
const serverless = require('serverless-http');
const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config();
const fs = require('fs');

console.log('🚀 SERVER FUNCTION STARTED');

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
});

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

const app = express();

app.use((err, req, res, next) => {
  console.error('❌ Серверная ошибка:', err);
  res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
});


const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'https://bhstore.netlify.app/auth/discord/callback';
const BOT_API_URL = process.env.BOT_API_URL || 'https://bhstore.netlify.app';
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const JWT_SECRET = process.env.JWT_SECRET || 'bhstore-super-secret-key-change-in-production-2024';
const TOKEN_EXPIRY = '24h';

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
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  // Добавляем новые колонки, если они отсутствуют (для существующей таблицы)
  await sql`
    ALTER TABLE promocodes 
    ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP,
    ADD COLUMN IF NOT EXISTS valid_until TIMESTAMP,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS valid_days INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

// ============================================
// API для работы с настройками магазина
// ============================================

app.get('/api/shop-settings', async (req, res) => {
  try {
    if (!sql) {
      return res.json({
        success: true,
        settings: {
          shop_closed: false,
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

// Обновить настройку магазина
app.post('/api/admin/shop-settings', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      
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
      
      const allowedKeys = ['shop_closed', 'registration_enabled', 'site_access'];
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
      
      try {
        const webhookUrl = process.env.DISCORD_WEBHOOK_ADMIN || 'https://discord.com/api/webhooks/1475843665921576960/dzWLdmiJOrsOH_Lnvj7I3DVB69UaAiCg4b-Leiu7-LlhiZZzVYL2thbjvXdXvwtVTw89';
        
        const settingNames = {
          'shop_closed': '🏪 Магазин',
          'registration_enabled': '📝 Регистрация',
          'site_access': '🌐 Доступ к сайту'
        };
        
        const statusText = setting_value ? '❌ ЗАКРЫТ' : '✅ ОТКРЫТ';
        
        await axios.post(webhookUrl, {
          embeds: [{
            title: '⚙️ Изменение настройки',
            description: `${settingNames[setting_key]} теперь **${statusText}**`,
            color: setting_value ? 0xED4245 : 0x57F287,
            fields: [
              { name: '👤 Администратор', value: decoded.username || decoded.id, inline: true },
              { name: '🕐 Время', value: new Date().toLocaleString('ru-RU'), inline: true }
            ],
            timestamp: new Date().toISOString()
          }]
        }).catch(console.error);
      } catch (webhookError) {
        console.error('Ошибка отправки вебхука:', webhookError.message);
      }
      
      res.json({
        success: true,
        message: `Настройка "${setting_key}" обновлена`,
        setting: {
          key: setting_key,
          value: setting_value
        }
      });
      
    } catch (decodeError) {
      return res.status(401).json({ success: false, error: 'Неверный токен' });
    }
    
  } catch (error) {
    console.error('❌ Ошибка обновления настроек:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка обновления настроек' 
    });
  }
});

// Получить статус магазина
app.get('/api/shop-status', async (req, res) => {
  try {
    if (!sql) {
      return res.json({
        success: true,
        shop_closed: false
      });
    }
    
    const [setting] = await sql`
      SELECT setting_value FROM shop_settings WHERE setting_key = 'shop_closed'
    `;
    
    console.log('📡 Запрос статуса магазина:', setting?.setting_value);
    
    res.json({
      success: true,
      shop_closed: setting?.setting_value || false
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения статуса магазина:', error.message);
    res.json({
      success: true,
      shop_closed: false
    });
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
          const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
          
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
      
      try {
          const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
          
          if (decoded.id !== userId) {
              const [user] = await sql`
                  SELECT badges FROM users WHERE discord_id = ${decoded.id}
              `;
              
              const isAdmin = user?.badges?.admin === true || decoded.id === '992442453833547886';
              
              if (!isAdmin) {
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
              messages: messages,
              total: messages.length
          });
          
      } catch (decodeError) {
          console.error('❌ Ошибка декодирования токена:', decodeError);
          return res.status(401).json({ success: false, error: 'Неверный токен' });
      }
      
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
      
      try {
          const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
          
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
                  const webhookUrl = process.env.DISCORD_WEBHOOK_CHAT || 'https://discord.com/api/webhooks/1475844623250227430/Q0fZcJ4U1WuqsyWb6-L_mFemtOPlUQFbzoJkO0V_T2kpOce5OGRZz4D5xzk12FE0mvKG';
                  
                  console.log('Попытка отправки вебхука от пользователя...');
                  
                  await axios.post(webhookUrl, {
                      embeds: [{
                          title: '💬 Новое сообщение от пользователя',
                          description: message,
                          color: 0x5865F2,
                          fields: [
                              { name: '👤 Пользователь', value: `<@${userId}>`, inline: true },
                              { name: '📝 Имя', value: user?.username || 'Неизвестно', inline: true }
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
          
      } catch (decodeError) {
          console.error('Ошибка декодирования токена:', decodeError);
          return res.status(401).json({ success: false, error: 'Неверный токен' });
      }
      
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
      
      try {
          const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
          
          const { userId, lastChecked } = req.body;
          
          if (!userId) {
              return res.status(400).json({ success: false, error: 'Не указан userId' });
          }
          
          if (decoded.id !== userId) {
              const [user] = await sql`
                  SELECT badges FROM users WHERE discord_id = ${decoded.id}
              `;
              
              const isAdmin = user?.badges?.admin === true || decoded.id === '992442453833547886';
              
              if (!isAdmin) {
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
              hasNew: parseInt(result.count) > 0,
              newCount: parseInt(result.count),
              adminTyping: false
          });
          
      } catch (decodeError) {
          console.error('Ошибка декодирования токена:', decodeError);
          return res.status(401).json({ success: false, error: 'Неверный токен' });
      }
      
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
          const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
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
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      
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
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      
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
          const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
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
app.get('/api/user/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    if (sql) {
      try {
        const [user] = await sql`
          SELECT * FROM users WHERE discord_id = ${userId}
        `;
        
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
              orders: user.orders || []
            }
          });
        }
      } catch (dbError) {
        console.error('❌ Ошибка БД:', dbError.message);
      }
    }
    
    const user = users[userId];
    
    if (!user) {
      return res.json({ 
        success: true, 
        user: null 
      });
    }
    
    res.json({
      success: true,
      user: {
        discordId: user.discordId,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        registeredAt: user.registeredAt,
        balance: user.balance || 0,
        badges: user.badges || {},
        orders: (user.orders || []).slice(-10)
      }
    });

  } catch (error) {
    console.error('Ошибка получения пользователя:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка сервера' 
    });
  }
});

// Получение баланса пользователя
app.get('/api/user/:id/balance', async (req, res) => {
  try {
    const userId = req.params.id;
    
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

// Получение заказов пользователя
app.get('/api/user/:id/orders', async (req, res) => {
  try {
      const [user] = await sql`
          SELECT orders FROM users WHERE discord_id = ${req.params.id}
      `;
      
      res.json({
          success: true,
          orders: user?.orders || []
      });
  } catch (error) {
      console.error('❌ Ошибка получения заказов:', error.message);
      res.status(500).json({ 
          success: false, 
          error: 'Ошибка сервера' 
      });
  }
});

// Получение информации о текущем пользователе
app.get('/api/user/me', async (req, res) => {
  try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
          return res.status(401).json({ success: false, error: 'Не авторизован' });
      }

      const token = authHeader.replace('Bearer ', '');
      
      try {
          const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
          
          let userData = null;
          
          if (sql) {
              const [user] = await sql`
                  SELECT * FROM users WHERE discord_id = ${decoded.id}
              `;
              userData = user;
          } else {
              userData = users[decoded.id];
          }
          
          if (!userData) {
              return res.json({ 
                  success: true, 
                  user: {
                      discordId: decoded.id,
                      username: decoded.username,
                      avatar: decoded.avatar,
                      badges: {}
                  }
              });
          }
          
          res.json({
              success: true,
              user: {
                  discordId: userData.discord_id || userData.discordId,
                  username: userData.username,
                  avatar: userData.avatar,
                  registeredAt: userData.registered_at || userData.registeredAt,
                  balance: userData.balance || 0,
                  badges: userData.badges || {},
                  isAdmin: userData.badges?.admin === true || decoded.id === '992442453833547886'
              }
          });

      } catch (decodeError) {
          return res.status(401).json({ success: false, error: 'Неверный токен' });
      }
      
  } catch (error) {
      console.error('❌ Ошибка получения пользователя:', error.message);
      res.status(500).json({ 
          success: false, 
          error: 'Ошибка сервера' 
      });
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
          await sql`
            INSERT INTO users (discord_id, username, email, avatar, balance, badges)
            VALUES (
              ${userData.id}, 
              ${userData.username}, 
              ${userData.email || ''}, 
              ${userData.avatar}, 
              0,
              ${JSON.stringify({})}
            )
          `;
          console.log('Пользователь сохранен в БД');
        } else {
          await sql`
            UPDATE users 
            SET username = ${userData.username}, 
                email = ${userData.email || ''}, 
                avatar = ${userData.avatar}
            WHERE discord_id = ${userData.id}
          `;
          console.log('Данные пользователя обновлены в БД');
        }
      } catch (dbError) {
        console.error('Ошибка сохранения в БД (используем память):', dbError.message);
      }
    }

    const token = Buffer.from(JSON.stringify({
      ...userData,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000
    })).toString('base64');

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
    
    const webhookUrl = 'https://discord.com/api/webhooks/1475846621425303674/Cm1D7yfWCjoh0nJys6jyedmEawUID6kpe2ycOc7xfjIC-p0M7i341cekSOVfMA2HLWn5';
    
    await axios.post(webhookUrl, {
      content: `<@${userId}>`,
      embeds: [{
        title: '<:Hearts:1474933149422059712> Код верификации',
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
      
      const webhookUrl = 'https://discord.com/api/webhooks/1475846621425303674/Cm1D7yfWCjoh0nJys6jyedmEawUID6kpe2ycOc7xfjIC-p0M7i341cekSOVfMA2HLWn5';
      
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
      const webhookUrl = 'https://discord.com/api/webhooks/1475847164801581127/8YklZGMVs-4reVU9yr4WbsO5OM1R5l2lM6yYmYyIPxhFICS1fDRZCD4ATL8sLEIaF1v5';
      
      const embed = {
        title: '💰 Новая покупка!',
        description: `<@${userId}> купил "${productName}"`,
        color: 0x57F287,
        fields: [
          { name: '💰 Цена', value: `${finalPrice} ₽`, inline: true },
          { name: '📦 Заказ', value: orderId, inline: true },
          { name: '💎 Баланс после', value: `${newBalance} ₽`, inline: true }
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
  return [    {
    "id": "discord_bot_economy",
    "name": "Экономический бот",
    "description": "Что входит в тариф:",
    "price": 999,
    "category": "discordbot",
    "icon": "image/emoji/shop_discord.png",
    "features": [
      "База данных - JSON или DATABASE",
      "Команды: !хелп, !баланс, !продать, !купить-товар, !вывести, !положить, !профиль, !работа, !казино, !магазин, !добавить-товар, !убрать-товар, !выдать-монеты, !снять-монеты.",
      "Выбор формата команд - Slash Commands или Default Commands",
      "Язык команд на ваше усмотрение - Русский(!хелп) или Английский(!help)",
      "Язык ответа на ваше усмотрение - Русский или Английский",
      "Дизайн эмодзи на выбор - Белый, Синий, Фиолетовый, Красный.",
      "Гарантия 2 недели"
    ]
  },
  {
    "id": "discord_bot_moderation",
    "name": "Модераторский бот",
    "description": "Что входит в тариф:",
    "price": 1119,
    "category": "discordbot",
    "icon": "image/emoji/shop_discord.png",
    "features": [
      "База данных - JSON или DATABASE",
      "Команды: !хелп, !бан, !банлист, !разбан, !варн, !варнлист, !варнснять, !мьют, !размьют, !мутлист, !войскик, !изменить-ник.",
      "Выбор формата команд - Slash Commands или Default Commands",
      "Язык команд на ваше усмотрение - Русский(!хелп) или Английский(!help)",
      "Язык ответа на ваше усмотрение - Русский или Английский",
      "Дизайн эмодзи на выбор - Белый, Синий, Фиолетовый, Красный.",
      "Гарантия 2 недели"
    ]
  },
  {
    "id": "discord_bot_levels",
    "name": "Уровень бот",
    "description": "Что входит в тариф:",
    "price": 888,
    "category": "discordbot",
    "icon": "image/emoji/shop_discord.png",
    "features": [
      "База данных - JSON или DATABASE",
      "Команды: !хелп, !ранг, !выдать-опыт, !снять-опыт, !выдать-уровень, !снять-уровень, !ранг-топ, !общий-сброс.",
      "Настройки: !настройка - Настроить за определенный уровень выдачу роли.",
      "Выбор формата команд - Slash Commands или Default Commands",
      "Язык команд на ваше усмотрение - Русский(!хелп) или Английский(!help)",
      "Язык ответа на ваше усмотрение - Русский или Английский",
      "Дизайн эмодзи на выбор - Белый, Синий, Фиолетовый, Красный.",
      "Гарантия 2 недели"
    ]
  },
  {
    "id": "discord_bot_all",
    "name": "Полноценный бот",
    "description": "Что входит в тариф:",
    "price": 1999,
    "category": "discordbot",
    "icon": "image/emoji/shop_discord.png",
    "features": [
      "Тариф: Экономический бот",
      "Тариф: Модераторский бот",
      "Тариф: Уровень бот",
      "Команды: !хелп, !профиль, !сервер, !бот...",
      "Выбор формата команд - Slash Commands или Default Commands",
      "Язык команд на ваше усмотрение - Русский(!хелп) или Английский(!help)",
      "Язык ответа на ваше усмотрение - Русский или Английский",
      "Дизайн эмодзи на выбор - Любой",
      "Гарантия 1 мес."
    ]
  },
  {
    "id": "discord_guild_full",
    "name": "Полная настройка Discord сервера",
    "description": "Что входит в тариф:",
    "price": 999,
    "category": "discord",
    "icon": "image/emoji/shop_discord.png",
    "features": [
      "1. Полная настройка всех функций Discord",
      "2. Авто-модерация",
      "3. Каналы-роли",
      "4. Дизайн Каналы, Категории, Роли, Голосовые, Трибуны, Форумы",
      "5. Права для всех каналов..."
    ]
  },
  {
    "id": "video_montaz_easy",
    "name": "Монтаж для видео",
    "description": "Уровень: Easy",
    "price": 499,
    "category": "youtube",
    "icon": "image/emoji/montaz.png",
    "features": [
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
      "Проффесиональные переходы",
      "Проффесиональные спец.эффекты",
      "Проффесиональные звуки",
      "Проффесиональное изменение голосов",
      "Проффесиональное соединение клипов"
    ]
  }
  ];
}

productsData = getTestProducts();
console.log(`✅ Загружено ${productsData.length} тестовых товаров`);

// ============================================
// Новости
// ============================================

// Получение новостей
app.get('/api/news', async (req, res) => {
  try {
    console.log('Запрос новостей');
    
    let news = [];
    
    if (sql) {
      try {
        news = await sql`
          SELECT * FROM news 
          ORDER BY created_at DESC 
          LIMIT 20
        `;
        
        console.log(`Загружено ${news.length} новостей из БД`);
        
        const formattedNews = news.map(item => ({
          id: item.id,
          title: item.title,
          content: item.content,
          date: item.date ? new Date(item.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          category: item.category,
          views: item.views || 0,
          author: item.author || 'BHStore',
          tags: item.tags || [],
          image: item.image || null,
          created_at: item.created_at
        }));
        
        return res.json({
          success: true,
          news: formattedNews,
          total: formattedNews.length
        });
        
      } catch (dbError) {
        console.error('Ошибка при работе с БД новостей:', dbError.message);
      }
    }
    
    console.log('БД не доступна или нет новостей, используем демо-данные');
    const demoNews = getDemoNews();
    
    res.json({
      success: true,
      news: demoNews,
      total: demoNews.length,
      notice: 'Используются демо-новости. Добавьте новости в БД через админ-панель.'
    });
    
  } catch (error) {
    console.error('Ошибка получения новостей:', error.message);
    res.json({
      success: true,
      news: getDemoNews(),
      total: getDemoNews().length
    });
  }
});

app.get('/api/news/:id', async (req, res) => {
  try {
    const newsId = parseInt(req.params.id);
    
    if (sql) {
      try {
        const [newsItem] = await sql`
          SELECT * FROM news WHERE id = ${newsId}
        `;
        
        if (newsItem) {
          await sql`
            UPDATE news 
            SET views = views + 1 
            WHERE id = ${newsId}
          `;
          
          return res.json({
            success: true,
            news: {
              id: newsItem.id,
              title: newsItem.title,
              content: newsItem.content,
              date: newsItem.date ? new Date(newsItem.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
              category: newsItem.category,
              views: (newsItem.views || 0) + 1,
              author: newsItem.author || 'BHStore',
              tags: newsItem.tags || [],
              image: newsItem.image || null,
              created_at: newsItem.created_at
            }
          });
        }
      } catch (dbError) {
        console.error('Ошибка БД:', dbError.message);
      }
    }
    
    const demoNews = getDemoNews();
    const article = demoNews.find(n => n.id === newsId);
    
    if (article) {
      return res.json({
        success: true,
        news: article
      });
    }
    
    return res.status(404).json({
      success: false,
      error: 'Новость не найдена'
    });
    
  } catch (error) {
    console.error('Ошибка получения новости:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка загрузки новости' 
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
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    
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
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    
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
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    
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
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    
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
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    
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
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    
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
// НАСТРОЙКИ МАГАЗИНА (ИНИЦИАЛИЗАЦИЯ ТАБЛИЦЫ)
// ============================================

// Добавить начальные настройки в БД
async function initShopSettings() {
  if (!sql) return;
  
  const settings = ['shop_closed', 'registration_enabled', 'site_access'];
  for (const key of settings) {
    const [exists] = await sql`
      SELECT 1 FROM shop_settings WHERE setting_key = ${key}
    `;
    if (!exists) {
      await sql`
        INSERT INTO shop_settings (setting_key, setting_value)
        VALUES (${key}, ${key === 'shop_closed' ? false : true})
      `;
    }
  }
  console.log('✅ Настройки магазина инициализированы');
}

// ============================================
// Админ маршруты
// ============================================

function isAdminUser(decodedToken) {
  const adminIds = ['992442453833547886'];
  return adminIds.includes(decodedToken.id);
}

// ============================================
// Админ маршруты для управления пользователями
// ============================================

app.post('/api/admin/news', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());      
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
            const webhookUrl = 'https://discord.com/api/webhooks/1475843665921576960/dzWLdmiJOrsOH_Lnvj7I3DVB69UaAiCg4b-Leiu7-LlhiZZzVYL2thbjvXdXvwtVTw89';
            
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
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      
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
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      
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
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      
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
          const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
          
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
          const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
          
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
          const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
          
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
          const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
          
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
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    
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
          const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
          
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
          const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
          
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
          const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
          
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
          const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
          
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
          const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
          
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
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    
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
      
      try {
          const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
          
          if (decoded.id === '992442453833547886') {
              console.log('Hardcoded admin access');
              return res.json({ isAdmin: true });
          }
          
          if (sql) {
              const [user] = await sql`
                  SELECT badges FROM users WHERE discord_id = ${decoded.id}
              `;
              
              if (user?.badges?.admin) {
                  return res.json({ isAdmin: true });
              }
          }
          
          res.json({ isAdmin: false });

      } catch (decodeError) {
          res.json({ isAdmin: false });
      }
      
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
    
    if (!userId || !code) {
      return res.status(400).json({ 
        success: false, 
        error: 'Не указаны userId или code' 
      });
    }
    
    const codeUpper = code.toUpperCase();
    const now = new Date();
    console.log(`🔍 Проверка промокода: ${codeUpper} для пользователя ${userId}`);
    
    let promocode = null;
    
    if (sql) {
      const [result] = await sql`
        SELECT * FROM promocodes 
        WHERE UPPER(code) = ${codeUpper}
      `;
      promocode = result;
    } else {
      promocode = promocodes[codeUpper];
    }
    
    if (!promocode) {
      console.log(`❌ Промокод ${codeUpper} не найден`);
      return res.status(404).json({ 
        success: false, 
        error: 'Промокод не найден' 
      });
    }
    
    // Проверка активности
    if (!promocode.active) {
      return res.status(400).json({ 
        success: false, 
        error: 'Промокод неактивен' 
      });
    }
    
    // ===== ПРОВЕРКА ЛИМИТА ИСПОЛЬЗОВАНИЙ (ДЛЯ ВСЕХ ТИПОВ) =====
    // Проверяем глобальный лимит
    if (promocode.max_uses && promocode.used_count >= promocode.max_uses) {
      return res.status(400).json({ 
        success: false, 
        error: 'Промокод больше недействителен (достигнут общий лимит использований)' 
      });
    }
    
    // Проверяем, использовал ли уже пользователь этот промокод (личный лимит)
    const usedBy = promocode.used_by || [];
    if (usedBy.includes(userId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Вы уже использовали этот промокод (можно только 1 раз)' 
      });
    }
    
    // ===== ДЛЯ СКИДОЧНЫХ ПРОМОКОДОВ - ПРОВЕРКА ПЕРИОДА ДЕЙСТВИЯ =====
    if (promocode.type === 'discount') {
      if (promocode.valid_from) {
        const validFrom = new Date(promocode.valid_from);
        if (now < validFrom) {
          const startDate = validFrom.toLocaleDateString('ru-RU');
          return res.status(400).json({ 
            success: false, 
            error: `Промокод начнет действовать с ${startDate}` 
          });
        }
      }
      
      if (promocode.valid_until) {
        const validUntil = new Date(promocode.valid_until);
        if (now > validUntil) {
          const endDate = validUntil.toLocaleDateString('ru-RU');
          return res.status(400).json({ 
            success: false, 
            error: `Период действия промокода истек ${endDate}` 
          });
        }
      }
    }
    
    console.log(`✅ Промокод ${codeUpper} найден, тип: ${promocode.type}, значение: ${promocode.value}`);
    console.log(`📊 Статистика: использован ${promocode.used_count || 0} раз(а) из ${promocode.max_uses || '∞'}`);
    
    // Формируем ответ
    const responseData = {
      success: true,
      promocode: {
        code: promocode.code,
        type: promocode.type,
        value: promocode.value,
        max_uses: promocode.max_uses,
        used_count: promocode.used_count || 0
      }
    };
    
    // Добавляем информацию для скидочных промокодов
    if (promocode.type === 'discount') {
      responseData.promocode.product_ids = promocode.product_ids || [];
      responseData.promocode.valid_from = promocode.valid_from;
      responseData.promocode.valid_until = promocode.valid_until;
      responseData.promocode.valid_days = promocode.valid_days;
    }
    
    res.json(responseData);
    
  } catch (error) {
    console.error('Ошибка проверки промокода:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка проверки промокода: ' + error.message 
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
    } else {
      promocode = promocodes[codeUpper];
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
        error: 'Промокод неактивен' 
      });
    }
    
    // ===== ПРОВЕРКА ЛИМИТА ИСПОЛЬЗОВАНИЙ =====
    // Глобальный лимит
    if (promocode.max_uses && promocode.used_count >= promocode.max_uses) {
      return res.status(400).json({ 
        success: false, 
        error: 'Промокод больше недействителен (достигнут общий лимит использований)' 
      });
    }
    
    // Личный лимит (пользователь уже использовал)
    const usedBy = promocode.used_by || [];
    if (usedBy.includes(userId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Вы уже использовали этот промокод (можно только 1 раз)' 
      });
    }
    
    // ===== ДЛЯ СКИДОЧНЫХ ПРОМОКОДОВ - ПРОВЕРКА ПЕРИОДА =====
    if (promocode.type === 'discount') {
      if (promocode.valid_from) {
        const validFrom = new Date(promocode.valid_from);
        if (now < validFrom) {
          const startDate = validFrom.toLocaleDateString('ru-RU');
          return res.status(400).json({ 
            success: false, 
            error: `Промокод начнет действовать с ${startDate}` 
          });
        }
      }
      
      if (promocode.valid_until) {
        const validUntil = new Date(promocode.valid_until);
        if (now > validUntil) {
          const endDate = validUntil.toLocaleDateString('ru-RU');
          return res.status(400).json({ 
            success: false, 
            error: `Период действия промокода истек ${endDate}` 
          });
        }
      }
    }
    
    // ===== РАСЧЕТ ДАТЫ ИСТЕЧЕНИЯ =====
    let expiresAt = null;
    if (promocode.type === 'discount' && promocode.valid_days && promocode.valid_days > 0) {
      expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + promocode.valid_days);
      console.log(`⏰ Скидочный промокод будет активен до ${expiresAt.toISOString()}`);
    }
    
    // ===== ОБНОВЛЯЕМ ПРОМОКОД =====
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
      console.log(`📊 Обновлена статистика: использован ${newUsedCount} раз(а) из ${promocode.max_uses}`);
    } else {
      promocode.used_count = newUsedCount;
      promocode.used_by = usedBy;
    }
    
    let newBalance = null;
    
    // ===== ДЛЯ БАЛАНСОВЫХ ПРОМОКОДОВ =====
    if (promocode.type === 'balance') {
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
          console.log(`✅ Баланс обновлен: ${userId} -> ${newBalance} ₽ (пополнение на ${promocode.value}₽)`);
        }
      } else {
        if (users[userId]) {
          newBalance = (users[userId].balance || 0) + promocode.value;
          users[userId].balance = newBalance;
        }
      }
    }
    
    console.log(`✅ Промокод ${promocode.code} активирован для ${userId}, тип: ${promocode.type}`);
    
    // Формируем ответ
    const responseData = {
      success: true,
      message: promocode.type === 'balance' ? 
        `💰 Баланс пополнен на ${promocode.value}₽` :
        `✓ Промокод "${promocode.code}" активирован! Скидка ${promocode.value}%`,
      newBalance: newBalance,
      value: promocode.value,
      type: promocode.type,
      code: promocode.code,
      used_at: now.toISOString(),
      used_count: newUsedCount,
      max_uses: promocode.max_uses
    };
    
    // Добавляем информацию для скидочных
    if (promocode.type === 'discount') {
      responseData.expires_at = expiresAt;
      responseData.valid_days = promocode.valid_days;
      responseData.valid_from = promocode.valid_from;
      responseData.valid_until = promocode.valid_until;
      responseData.product_ids = promocode.product_ids || [];
    }
    
    res.json(responseData);
    
  } catch (error) {
    console.error('Ошибка активации промокода:', error.message);
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
          product_ids,
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
        usedAtFormatted: new Date(usedAt).toLocaleString('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        valid_from: promo.valid_from,
        valid_until: promo.valid_until,
        valid_days: promo.valid_days,
        product_ids: promo.product_ids || []
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
    const webhookUrl = 'https://discord.com/api/webhooks/1475843665921576960/dzWLdmiJOrsOH_Lnvj7I3DVB69UaAiCg4b-Leiu7-LlhiZZzVYL2thbjvXdXvwtVTw89';
    
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
      
      const webhookUrl = process.env.DISCORD_WEBHOOK_CHAT || 'https://discord.com/api/webhooks/1475844623250227430/Q0fZcJ4U1WuqsyWb6-L_mFemtOPlUQFbzoJkO0V_T2kpOce5OGRZz4D5xzk12FE0mvKG';
      
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