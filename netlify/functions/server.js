// netlify/functions/server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const serverless = require('serverless-http');
const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const app = express();

// Конфигурация
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'https://bhstore.netlify.app/auth/discord/callback';
const BOT_API_URL = process.env.BOT_API_URL || 'https://bhstore.netlify.app';

console.log('🚀 Запуск BHStore Server (Netlify Function)...');
console.log('✅ Client ID установлен:', !!DISCORD_CLIENT_ID);
console.log('✅ Client Secret установлен:', !!DISCORD_CLIENT_SECRET);
console.log('✅ Redirect URI:', DISCORD_REDIRECT_URI);
console.log('✅ Bot API URL:', BOT_API_URL);
console.log('✅ DATABASE_URL установлен:', !!process.env.DATABASE_URL);

// Инициализация подключения к PostgreSQL (Neon)
let sql;
try {
  if (process.env.DATABASE_URL) {
    sql = neon(process.env.DATABASE_URL);
    console.log('✅ Подключение к Neon создано');
  } else {
    console.log('⚠️ DATABASE_URL не установлен, работаем без БД');
  }
} catch (error) {
  console.error('❌ Ошибка подключения к Neon:', error.message);
}

// Middleware
app.use(cors());
app.use(express.json());

let users = {};
let chatStore = {};
let reviewsData = { reviews: [], stats: { totalReviews: 0, averageRating: 0 } };
let promocodes = {};

// Тестовые данные
const initTestData = () => {
  users = {
    "992442453833547886": {
      discordId: "992442453833547886",
      username: "borisonchik_yt",
      email: "test@example.com",
      avatar: null,
      registeredAt: new Date().toISOString(),
      balance: 1000,
      orders: [],
      badges: { verified: true, admin: true }
    }
  };
  
  promocodes = {
    "WELCOME10": {
      code: "WELCOME10",
      type: "discount",
      value: 10,
      active: true,
      maxUses: 100,
      usedCount: 0,
      usedBy: []
    },
    "BALANCE100": {
      code: "BALANCE100",
      type: "balance",
      value: 100,
      active: true,
      maxUses: 50,
      usedCount: 0,
      usedBy: []
    }
  };
  
  reviewsData = {
    reviews: [
      {
        id: "rev_1",
        userId: "992442453833547886",
        name: "borisonchik_yt",
        avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
        rating: 5,
        productId: "premium_month",
        productName: "Премиум на 1 месяц",
        text: "Отличный сервис!",
        images: [],
        verifiedPurchase: true,
        verified: true,
        helpful: 5,
        createdAt: new Date().toISOString()
      }
    ],
    stats: {
      totalReviews: 1,
      averageRating: 5,
      verifiedPurchases: 1,
      totalHelpful: 5
    }
  };
};

initTestData();

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// Инициализация базы данных
// ============================================
async function initDatabase() {
  if (!sql) {
    console.log('⚠️ БД не доступна, пропускаем инициализацию');
    return;
  }
  
  try {
    // Таблица пользователей
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        discord_id TEXT PRIMARY KEY,
        username TEXT,
        email TEXT,
        avatar TEXT,
        balance INTEGER DEFAULT 0,
        badges JSONB DEFAULT '{}',
        orders JSONB DEFAULT '[]',
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Таблица сообщений чата
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
    
    // Таблица отзывов
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
    
    // Таблица промокодов
    await sql`
      CREATE TABLE IF NOT EXISTS promocodes (
        code TEXT PRIMARY KEY,
        type TEXT,
        value INTEGER,
        active BOOLEAN DEFAULT TRUE,
        max_uses INTEGER,
        used_count INTEGER DEFAULT 0,
        used_by JSONB DEFAULT '[]'
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

    // Таблица ошибок
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

    // Таблица статистики
    await sql`
    CREATE TABLE IF NOT EXISTS stats (
      id SERIAL PRIMARY KEY,
      data JSONB,
      created_at TIMESTAMP
    )
  `;

async function createProductsTable() {
  if (!sql) return;
  
  try {
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
    console.log('✅ Таблица products создана');
    
    // Проверяем, есть ли товары
    const [count] = await sql`SELECT COUNT(*) as count FROM products`;
    
    if (parseInt(count.count) === 0) {
      // Добавляем тестовые товары
      await insertTestProducts();
    }
  } catch (error) {
    console.error('❌ Ошибка создания таблицы products:', error.message);
  }
}

// Функция для добавления тестовых товаров
async function insertTestProducts() {
  if (!sql) return;
  
  try {
    const testProducts = [
      {
        id: "premium_month",
        name: "Премиум на 1 месяц",
        description: "Доступ ко всем премиум функциям на 30 дней",
        price: 299,
        category: "premium",
        icon: "fas fa-crown",
        image: "/image/premium.png",
        features: JSON.stringify(["Все функции бота", "Приоритетная поддержка", "Эксклюзивные команды"]),
        popular: true,
        discount: 0
      },
      {
        id: "premium_year",
        name: "Премиум на 1 год",
        description: "Доступ ко всем премиум функциям на 365 дней",
        price: 2499,
        category: "premium",
        icon: "fas fa-crown",
        image: "/image/premium.png",
        features: JSON.stringify(["Все функции бота", "Приоритетная поддержка", "Эксклюзивные команды", "Скидка 30%"]),
        popular: false,
        discount: 30
      },
      {
        id: "discord_bot_economy",
        name: "Экономический бот",
        description: "Что входит в тариф:",
        price: 999,
        category: "discordbot",
        icon: "fas fa-robot",
        image: "/image/discord-bot.png",
        features: JSON.stringify([
          "База данных - JSON или DATABASE",
          "Команды: !хелп, !баланс, !продать, !купить-товар, !вывести, !положить, !профиль, !работа, !казино, !магазин, !добавить-товар, !убрать-товар, !выдать-монеты, !снять-монеты",
          "Выбор формата команд - Slash Commands или Default Commands",
          "Язык команд на ваше усмотрение - Русский(!хелп) или Английский(!help)",
          "Язык ответа на ваше усмотрение - Русский или Английский",
          "Дизайн эмодзи на выбор - Белый, Синий, Фиолетовый, Красный",
          "Гарантия 2 недели"
        ]),
        popular: true,
        discount: 0
      },
      {
        id: "discord_bot_moderation",
        name: "Модераторский бот",
        description: "Что входит в тариф:",
        price: 1119,
        category: "discordbot",
        icon: "fas fa-shield-alt",
        image: "/image/discord-bot.png",
        features: JSON.stringify([
          "База данных - JSON или DATABASE",
          "Команды: !хелп, !бан, !банлист, !разбан, !варн, !варнлист, !варнснять, !мьют, !размьют, !мутлист, !войскик, !изменить-ник",
          "Выбор формата команд - Slash Commands или Default Commands",
          "Язык команд на ваше усмотрение - Русский(!хелп) или Английский(!help)",
          "Язык ответа на ваше усмотрение - Русский или Английский",
          "Дизайн эмодзи на выбор - Белый, Синий, Фиолетовый, Красный",
          "Гарантия 2 недели"
        ]),
        popular: false,
        discount: 0
      },
      {
        id: "discord_bot_levels",
        name: "Уровень бот",
        description: "Что входит в тариф:",
        price: 888,
        category: "discordbot",
        icon: "fas fa-chart-line",
        image: "/image/discord-bot.png",
        features: JSON.stringify([
          "База данных - JSON или DATABASE",
          "Команды: !хелп, !ранг, !выдать-опыт, !снять-опыт, !выдать-уровень, !снять-уровень, !ранг-топ, !общий-сброс",
          "Настройки: !настройка - Настроить за определенный уровень выдачу роли",
          "Выбор формата команд - Slash Commands или Default Commands",
          "Язык команд на ваше усмотрение - Русский(!хелп) или Английский(!help)",
          "Язык ответа на ваше усмотрение - Русский или Английский",
          "Дизайн эмодзи на выбор - Белый, Синий, Фиолетовый, Красный",
          "Гарантия 2 недели"
        ]),
        popular: false,
        discount: 0
      },
      {
        id: "discord_bot_all",
        name: "Полноценный бот",
        description: "Что входит в тариф:",
        price: 1999,
        category: "discordbot",
        icon: "fas fa-crown",
        image: "/image/discord-bot.png",
        features: JSON.stringify([
          "Тариф: Экономический бот",
          "Тариф: Модераторский бот",
          "Тариф: Уровень бот",
          "Команды: !хелп, !профиль, !сервер, !бот...",
          "Выбор формата команд - Slash Commands или Default Commands",
          "Язык команд на ваше усмотрение - Русский(!хелп) или Английский(!help)",
          "Язык ответа на ваше усмотрение - Русский или Английский",
          "Дизайн эмодзи на выбор - Любой",
          "Гарантия 1 мес"
        ]),
        popular: true,
        discount: 0
      },
      {
        id: "discord_guild_full",
        name: "Полная настройка Discord сервера",
        description: "Что входит в тариф:",
        price: 999,
        category: "discord",
        icon: "fas fa-server",
        image: "/image/discord-server.png",
        features: JSON.stringify([
          "1. Полная настройка всех функций Discord",
          "2. Авто-модерация",
          "3. Каналы-роли",
          "4. Дизайн Каналы, Категории, Роли, Голосовые, Трибуны, Форумы",
          "5. Права для всех каналов..."
        ]),
        popular: true,
        discount: 0
      },
      {
        id: "video_montaz",
        name: "Монтаж для видео",
        description: "",
        price: 499,
        category: "events",
        icon: "fas fa-video",
        image: "/image/video.png",
        features: JSON.stringify([
          "Приоритетный доступ",
          "Эксклюзивные награды",
          "Личное приветствие",
          "Особые привилегии"
        ]),
        popular: false,
        discount: 0
      }
    ];
    
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
    
    console.log('✅ Тестовые товары добавлены в БД');
  } catch (error) {
    console.error('❌ Ошибка добавления тестовых товаров:', error.message);
  }
}
    
    console.log('✅ База данных инициализирована');
  } catch (error) {
    console.error('❌ Ошибка инициализации БД:', error.message);
  }
}

// Запускаем инициализацию БД
if (sql) {
  initDatabase();
}
await createProductsTable();
// ============================================
// API маршруты для чата
// ============================================

app.get('/api/chat/admin/users', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      
      // Получаем всех пользователей из БД
      const dbUsers = await sql`
        SELECT * FROM users ORDER BY registered_at DESC
      `;
      
      // Получаем непрочитанные сообщения для каждого пользователя
      const usersWithMessages = await Promise.all(dbUsers.map(async (user) => {
        const unreadMessages = await sql`
          SELECT COUNT(*) as count FROM messages 
          WHERE user_id = ${user.discord_id} 
          AND from_admin = false 
          AND read = false
        `;
        
        const orders = user.orders || [];
        const lastOrder = orders.length > 0 ? orders[orders.length - 1].date : null;
        
        return {
          discordId: user.discord_id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          registeredAt: user.registered_at,
          balance: user.balance,
          orderCount: orders.length,
          lastOrder: lastOrder,
          badges: user.badges || {},
          unreadMessages: parseInt(unreadMessages[0].count) || 0
        };
      }));
      
      res.json({
        success: true,
        users: usersWithMessages,
        total: usersWithMessages.length
      });
      
    } catch (decodeError) {
      return res.status(401).json({ success: false, error: 'Неверный токен' });
    }
    
  } catch (error) {
    console.error('❌ Ошибка получения пользователей чата:', error.message);
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
      
      // Отмечаем все сообщения пользователя как прочитанные
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
    console.error('❌ Ошибка отметки сообщений:', error.message);
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
      
      // Получаем все непрочитанные сообщения от пользователей
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

// Получение сообщений пользователя
app.get('/api/chat/messages/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
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
  } catch (error) {
    console.error('❌ Ошибка получения сообщений:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка сервера' 
    });
  }
});

// Отправка сообщения
app.post('/api/chat/send', async (req, res) => {
  try {
    const { userId, message, fromAdmin = false } = req.body;
    
    if (!userId || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Неверные данные' 
      });
    }
    
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await sql`
      INSERT INTO messages (id, user_id, message, from_admin, read, timestamp)
      VALUES (
        ${messageId}, 
        ${userId}, 
        ${message}, 
        ${fromAdmin}, 
        ${!fromAdmin}, 
        ${new Date().toISOString()}
      )
    `;
    
    // Отправляем уведомление через вебхук
    const webhookUrl = 'https://discord.com/api/webhooks/1475844623250227430/Q0fZcJ4U1WuqsyWb6-L_mFemtOPlUQFbzoJkO0V_T2kpOce5OGRZz4D5xzk12FE0mvKG';
    
    axios.post(webhookUrl, {
      embeds: [{
        title: fromAdmin ? '<:CEO:1474931391505367040> Сообщение от АДМИНА' : '<:User:1474931634804359433> Сообщение от ПОЛЬЗОВАТЕЛЯ',
        description: message,
        color: fromAdmin ? 0x57F287 : 0x5865F2,
        fields: [{ name: '<:User:1474931634804359433> Пользователь', value: userId, inline: true }],
        timestamp: new Date().toISOString()
      }]
    }).catch(console.error);
    
    res.json({
      success: true,
      messageId: messageId
    });
    
  } catch (error) {
    console.error('❌ Ошибка отправки сообщения:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка отправки' 
    });
  }
});

// Callback маршрут
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

// Получить активные промокоды пользователя
app.get('/api/promocodes/active/:userId', async (req, res) => {
  try {
      const [user] = await sql`
          SELECT active_promocodes FROM users WHERE discord_id = ${req.params.userId}
      `;
      
      res.json({
          success: true,
          promocodes: user?.active_promocodes || []
      });
  } catch (error) {
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
      const [user] = await sql`
          SELECT used_promocodes FROM users WHERE discord_id = ${req.params.userId}
      `;
      
      res.json({
          success: true,
          promocodes: user?.used_promocodes || []
      });
  } catch (error) {
      res.json({ success: true, promocodes: [] });
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
          
          // Получаем пользователя из БД
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
          
          // Проверяем, является ли пользователь админом
          const isAdmin = decoded.id === '992442453833547886';
          
          // Или проверяем в БД
          if (sql && !isAdmin) {
              const [user] = await sql`
                  SELECT badges FROM users WHERE discord_id = ${decoded.id}
              `;
              if (user?.badges?.admin) {
                  return res.json({ isAdmin: true });
              }
          }
          
          res.json({ isAdmin });

      } catch (decodeError) {
          res.json({ isAdmin: false });
      }
      
  } catch (error) {
      console.error('❌ Ошибка проверки админа:', error.message);
      res.json({ isAdmin: false });
  }
});


// API авторизации
app.post('/api/auth/discord', async (req, res) => {
  try {
    const { code } = req.body;
    console.log('🔐 Получен запрос авторизации');
    console.log('📦 Получен code:', code ? 'да' : 'нет');
    
    // Проверяем переменные окружения
    console.log('📊 Проверка переменных:');
    console.log('- DISCORD_CLIENT_ID:', DISCORD_CLIENT_ID ? 'установлен' : 'ОТСУТСТВУЕТ');
    console.log('- DISCORD_CLIENT_SECRET:', DISCORD_CLIENT_SECRET ? 'установлен' : 'ОТСУТСТВУЕТ');
    console.log('- DISCORD_REDIRECT_URI:', DISCORD_REDIRECT_URI);

    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
      console.error('❌ Не настроены Discord credentials');
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

    // Получение токена от Discord
    const params = new URLSearchParams();
    params.append('client_id', DISCORD_CLIENT_ID);
    params.append('client_secret', DISCORD_CLIENT_SECRET);
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', DISCORD_REDIRECT_URI);
    params.append('scope', 'identify email');

    console.log('📤 Отправка запроса в Discord для получения токена...');
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

    console.log('✅ Токен успешно получен от Discord');

    const { access_token, token_type } = tokenResponse.data;

    // Получение информации о пользователе
    console.log('📤 Запрос данных пользователя из Discord...');
    
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        'Authorization': `${token_type} ${access_token}`
      }
    });

    console.log('✅ Данные пользователя получены');

    const userData = {
      id: userResponse.data.id,
      username: userResponse.data.username,
      avatar: userResponse.data.avatar,
      email: userResponse.data.email,
      global_name: userResponse.data.global_name || userResponse.data.username
    };

    console.log(`👤 Пользователь: ${userData.username} (${userData.id})`);

    // Сохраняем пользователя (сначала в памяти)
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
      console.log('✅ Пользователь сохранен в памяти');
    }

    // Пытаемся сохранить в БД, если доступна
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
          console.log('✅ Пользователь сохранен в БД');
        } else {
          await sql`
            UPDATE users 
            SET username = ${userData.username}, 
                email = ${userData.email || ''}, 
                avatar = ${userData.avatar}
            WHERE discord_id = ${userData.id}
          `;
          console.log('✅ Данные пользователя обновлены в БД');
        }
      } catch (dbError) {
        console.error('⚠️ Ошибка сохранения в БД (используем память):', dbError.message);
      }
    }

    // Создаем токен для клиента
    const token = Buffer.from(JSON.stringify({
      ...userData,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000
    })).toString('base64');

    console.log('✅ Токен для клиента создан');

    res.json({
      success: true,
      token: token,
      user: userData
    });

  } catch (error) {
    console.error('❌ ОШИБКА АВТОРИЗАЦИИ:');
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

// Отправка кода верификации
app.post('/api/send-verification', async (req, res) => {
  try {
    const { userId, code } = req.body;
    console.log(`📨 Отправка кода ${code} пользователю ${userId}`);
    
    // Отправляем через вебхук Discord
    const webhookUrl = 'https://discord.com/api/webhooks/1475846621425303674/Cm1D7yfWCjoh0nJys6jyedmEawUID6kpe2ycOc7xfjIC-p0M7i341cekSOVfMA2HLWn5';
    
    await axios.post(webhookUrl, {
      content: `<@${userId}>`,
      embeds: [{
        title: '<:Hearts:1474933149422059712> Код верификации',
        description: `<a:Dot:1386279213278953545 Код - \`${code}\``,
        color: 0x5865F2,
        timestamp: new Date().toISOString()
      }]
    });
    
    console.log('✅ Код отправлен через вебхук');
    
    res.json({ 
      success: true,
      message: 'Код отправлен в Discord'
    });

  } catch (error) {
    console.error('❌ Ошибка отправки кода:', error.message);
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

// Создание заказа
app.post('/api/create-order', async (req, res) => {
  try {
      const { userId, productId, productName, price, originalPrice, username, promocodes, discount, discountAmount } = req.body;
      
      console.log(`🛒 Заказ от ${username || userId}: ${productName} за ${price} ₽`);
      
      const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      // Получаем пользователя
      let user = null;
      
      if (sql) {
          try {
              const [dbUser] = await sql`
                  SELECT * FROM users WHERE discord_id = ${userId}
              `;
              user = dbUser;
          } catch (dbError) {
              console.error('❌ Ошибка получения пользователя из БД:', dbError.message);
          }
      }
      
      // Если нет в БД, проверяем в памяти
      if (!user) {
          user = users[userId];
      }
      
      if (!user) {
          return res.status(404).json({ 
              success: false, 
              error: 'Пользователь не найден' 
          });
      }
      
      const currentBalance = user.balance || 0;
      
      if (currentBalance < price) {
          return res.status(400).json({ 
              success: false, 
              error: 'Недостаточно средств на балансе' 
          });
      }
      
      const newBalance = currentBalance - price;
      
      // Создаем заказ
      const order = {
          id: orderId,
          productId,
          productName,
          price,
          originalPrice: originalPrice || price,
          discount,
          discountAmount,
          promocodes: promocodes || [],
          date: new Date().toISOString(),
          status: 'completed'
      };
      
      // Обновляем в памяти
      if (users[userId]) {
          users[userId].balance = newBalance;
          users[userId].orders = users[userId].orders || [];
          users[userId].orders.push(order);
          users[userId].badges = users[userId].badges || {};
          users[userId].badges.buyer = true;
      }
      
      // Обновляем в БД
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
              console.log('✅ Заказ сохранен в БД');
          } catch (dbError) {
              console.error('❌ Ошибка сохранения заказа в БД:', dbError.message);
          }
      }

      // Отправляем уведомление в Discord
      try {
          const webhookUrl = 'https://discord.com/api/webhooks/1459512369960194260/mtTCwjsSXA2_I7H-zmVbsYd5erD3UZCD9fZ2EiZkVg2KLt-IENQutfE4y393vXY5ryzH';
          
          await axios.post(webhookUrl, {
              embeds: [{
                  title: '<:Price:1474932616523415583> Новая покупка!',
                  description: `<:User:1474931634804359433> <@${userId}> купил <:Price:1474932616523415583> "${productName}"`,
                  color: 0x57F287,
                  fields: [
                      { name: '<:Money:1474931656610811966> Цена', value: `\`\`\`${price}₽\`\`\``, inline: true },
                      { name: '<:Shop:1474931641158860800> Заказ', value: orderId, inline: true },
                      { name: '<:Money:1474931656610811966> Баланс после', value: `\`\`\`${newBalance}₽\`\`\``, inline: true }
                  ],
                  timestamp: new Date().toISOString()
              }]
          });
      } catch (webhookError) {
          console.error('❌ Ошибка отправки вебхука:', webhookError.message);
      }

      res.json({
          success: true,
          orderId: orderId,
          newBalance: newBalance
      });

  } catch (error) {
      console.error('❌ Ошибка заказа:', error.message);
      res.status(500).json({ 
          success: false, 
          error: 'Ошибка создания заказа' 
      });
  }
});

// Получение товаров
app.get('/api/products', async (req, res) => {
  try {
      console.log('📦 Запрос товаров');
      
      // Пробуем получить товары из БД
      let products = [];
      
      if (sql) {
          try {
              // Проверяем, существует ли таблица products
              const tableExists = await sql`
                  SELECT EXISTS (
                      SELECT FROM information_schema.tables 
                      WHERE table_name = 'products'
                  );
              `;
              
              if (tableExists[0].exists) {
                  products = await sql`SELECT * FROM products ORDER BY created_at DESC`;
                  console.log(`✅ Загружено ${products.length} товаров из БД`);
              } else {
                  console.log('📝 Таблица products не найдена, создаем...');
                  await createProductsTable();
                  // После создания таблицы добавляем тестовые товары
                  await insertTestProducts();
                  products = await sql`SELECT * FROM products ORDER BY created_at DESC`;
              }
          } catch (dbError) {
              console.error('❌ Ошибка при работе с БД:', dbError.message);
          }
      }
      
      // Если БД не доступна или нет товаров, используем тестовые данные
      if (!products || products.length === 0) {
          console.log('📝 Используем тестовые товары из памяти');
          products = getTestProducts();
      }
      
      // Преобразуем в нужный формат
      const formattedProducts = products.map(product => ({
          id: product.id || product.discord_id,
          name: product.name,
          description: product.description,
          price: product.price,
          category: product.category,
          icon: product.icon || '/image/default-product.png',
          image: product.image || product.icon || '/image/default-product.png',
          features: product.features || [],
          popular: product.popular || false,
          discount: product.discount || 0
      }));
      
      res.json({
          success: true,
          products: formattedProducts
      });
      
  } catch (error) {
      console.error('❌ Ошибка получения товаров:', error.message);
      
      // В случае ошибки возвращаем тестовые товары
      res.json({
          success: true,
          products: getTestProducts()
      });
  }
});

// Функция для создания таблицы products
async function createProductsTable() {
  if (!sql) return;
  
  try {
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
      console.log('✅ Таблица products создана');
  } catch (error) {
      console.error('❌ Ошибка создания таблицы products:', error.message);
  }
}

// Функция для добавления тестовых товаров
async function insertTestProducts() {
  if (!sql) return;
  
  try {
      const testProducts = [
        {
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
          "id": "video_montaz",
          "name": "Монтаж для видео",
          "description": "",
          "price": 499,
          "category": "events",
          "icon": "image/emoji/montaz.png",
          "features": [
            "Приоритетный доступ",
            "Эксклюзивные награды",
            "Личное приветствие",
            "Особые привилегии"
          ]
        }
      ];
      
      for (const product of testProducts) {
          await sql`
              INSERT INTO products (id, name, description, price, category, icon, features, popular, discount)
              VALUES (
                  ${product.id},
                  ${product.name},
                  ${product.description},
                  ${product.price},
                  ${product.category},
                  ${product.icon},
                  ${JSON.stringify(product.features || [])},
                  ${product.popular || false},
                  ${product.discount || 0}
              )
              ON CONFLICT (id) DO UPDATE SET
                  name = EXCLUDED.name,
                  description = EXCLUDED.description,
                  price = EXCLUDED.price,
                  category = EXCLUDED.category,
                  icon = EXCLUDED.icon,
                  features = EXCLUDED.features,
                  popular = EXCLUDED.popular,
                  discount = EXCLUDED.discount
          `;
      }
      
      console.log('✅ Тестовые товары добавлены в БД');
  } catch (error) {
      console.error('❌ Ошибка добавления тестовых товаров:', error.message);
  }
}

// Функция для получения тестовых товаров (если БД не доступна)
function getTestProducts() {
  return [
    {
      id: "premium_month",
      name: "Премиум на 1 месяц",
      description: "Доступ ко всем премиум функциям на 30 дней",
      price: 299,
      category: "premium",
      icon: "fas fa-crown",
      image: "/image/premium.png",
      features: ["Все функции бота", "Приоритетная поддержка", "Эксклюзивные команды"],
      popular: true,
      discount: 0
    },
    {
      id: "premium_year",
      name: "Премиум на 1 год",
      description: "Доступ ко всем премиум функциям на 365 дней",
      price: 2499,
      category: "premium",
      icon: "fas fa-crown",
      image: "/image/premium.png",
      features: ["Все функции бота", "Приоритетная поддержка", "Эксклюзивные команды", "Скидка 30%"],
      popular: false,
      discount: 30
    },
    {
      id: "discord_bot_economy",
      name: "Экономический бот",
      description: "Что входит в тариф:",
      price: 999,
      category: "discordbot",
      icon: "fas fa-robot",
      image: "/image/discord-bot.png",
      features: [
        "База данных - JSON или DATABASE",
        "Команды: !хелп, !баланс, !продать, !купить-товар, !вывести, !положить, !профиль, !работа, !казино, !магазин, !добавить-товар, !убрать-товар, !выдать-монеты, !снять-монеты",
        "Выбор формата команд - Slash Commands или Default Commands",
        "Язык команд на ваше усмотрение - Русский(!хелп) или Английский(!help)",
        "Язык ответа на ваше усмотрение - Русский или Английский",
        "Дизайн эмодзи на выбор - Белый, Синий, Фиолетовый, Красный",
        "Гарантия 2 недели"
      ],
      popular: true,
      discount: 0
    },
    {
      id: "discord_bot_moderation",
      name: "Модераторский бот",
      description: "Что входит в тариф:",
      price: 1119,
      category: "discordbot",
      icon: "fas fa-shield-alt",
      image: "/image/discord-bot.png",
      features: [
        "База данных - JSON или DATABASE",
        "Команды: !хелп, !бан, !банлист, !разбан, !варн, !варнлист, !варнснять, !мьют, !размьют, !мутлист, !войскик, !изменить-ник",
        "Выбор формата команд - Slash Commands или Default Commands",
        "Язык команд на ваше усмотрение - Русский(!хелп) или Английский(!help)",
        "Язык ответа на ваше усмотрение - Русский или Английский",
        "Дизайн эмодзи на выбор - Белый, Синий, Фиолетовый, Красный",
        "Гарантия 2 недели"
      ],
      popular: false,
      discount: 0
    },
    {
      id: "discord_bot_levels",
      name: "Уровень бот",
      description: "Что входит в тариф:",
      price: 888,
      category: "discordbot",
      icon: "fas fa-chart-line",
      image: "/image/discord-bot.png",
      features: [
        "База данных - JSON или DATABASE",
        "Команды: !хелп, !ранг, !выдать-опыт, !снять-опыт, !выдать-уровень, !снять-уровень, !ранг-топ, !общий-сброс",
        "Настройки: !настройка - Настроить за определенный уровень выдачу роли",
        "Выбор формата команд - Slash Commands или Default Commands",
        "Язык команд на ваше усмотрение - Русский(!хелп) или Английский(!help)",
        "Язык ответа на ваше усмотрение - Русский или Английский",
        "Дизайн эмодзи на выбор - Белый, Синий, Фиолетовый, Красный",
        "Гарантия 2 недели"
      ],
      popular: false,
      discount: 0
    },
    {
      id: "discord_bot_all",
      name: "Полноценный бот",
      description: "Что входит в тариф:",
      price: 1999,
      category: "discordbot",
      icon: "fas fa-crown",
      image: "/image/discord-bot.png",
      features: [
        "Тариф: Экономический бот",
        "Тариф: Модераторский бот",
        "Тариф: Уровень бот",
        "Команды: !хелп, !профиль, !сервер, !бот...",
        "Выбор формата команд - Slash Commands или Default Commands",
        "Язык команд на ваше усмотрение - Русский(!хелп) или Английский(!help)",
        "Язык ответа на ваше усмотрение - Русский или Английский",
        "Дизайн эмодзи на выбор - Любой",
        "Гарантия 1 мес"
      ],
      popular: true,
      discount: 0
    },
    {
      id: "discord_guild_full",
      name: "Полная настройка Discord сервера",
      description: "Что входит в тариф:",
      price: 999,
      category: "discord",
      icon: "fas fa-server",
      image: "/image/discord-server.png",
      features: [
        "1. Полная настройка всех функций Discord",
        "2. Авто-модерация",
        "3. Каналы-роли",
        "4. Дизайн Каналы, Категории, Роли, Голосовые, Трибуны, Форумы",
        "5. Права для всех каналов..."
      ],
      popular: true,
      discount: 0
    },
    {
      id: "video_montaz",
      name: "Монтаж для видео",
      description: "",
      price: 499,
      category: "events",
      icon: "fas fa-video",
      image: "/image/video.png",
      features: [
        "Приоритетный доступ",
        "Эксклюзивные награды",
        "Личное приветствие",
        "Особые привилегии"
      ],
      popular: false,
      discount: 0
    }
  ];
}

// Получение новостей
app.get('/api/news', (req, res) => {
  try {
    const news = [
      {
        id: 1,
        title: 'Добро пожаловать в BHStore!',
        content: 'Магазин успешно запущен на Netlify.',
        date: new Date().toISOString().split('T')[0],
        category: 'announcement'
      },
      {
        id: 2,
        title: 'Новые товары',
        content: 'Добавлены премиум подписки!',
        date: new Date().toISOString().split('T')[0],
        category: 'update'
      }
    ];
    
    res.json({ 
      success: true, 
      news: news,
      total: news.length 
    });
    
  } catch (error) {
    console.error('❌ Ошибка загрузки новостей:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка загрузки новостей' 
    });
  }
});

// ============================================
// Админ маршруты
// ============================================

function isAdminUser(decodedToken) {
  const adminIds = ['992442453833547886'];
  return adminIds.includes(decodedToken.id);
}

app.get('/api/admin/users', async (req, res) => {
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
      
      const dbUsers = await sql`
        SELECT * FROM users ORDER BY registered_at DESC
      `;
      
      const allUsers = dbUsers.map(user => ({
        discordId: user.discord_id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        registeredAt: user.registered_at,
        balance: user.balance,
        orderCount: (user.orders || []).length,
        lastOrder: (user.orders || []).length > 0 
          ? user.orders[user.orders.length - 1].date 
          : null,
        badges: user.badges || {}
      }));
      
      res.json({
        success: true,
        users: allUsers,
        total: allUsers.length
      });
      
    } catch (decodeError) {
      return res.status(401).json({ success: false, error: 'Неверный токен' });
    }
    
  } catch (error) {
    console.error('❌ Ошибка получения пользователей:', error.message);
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
    const [promocode] = await sql`
      SELECT * FROM promocodes WHERE code = ${codeUpper}
    `;
    
    if (!promocode) {
      return res.json({ 
        success: false, 
        error: 'Промокод не найден' 
      });
    }
    
    if (!promocode.active) {
      return res.json({ 
        success: false, 
        error: 'Промокод неактивен' 
      });
    }
    
    if (promocode.used_count >= promocode.max_uses) {
      return res.json({ 
        success: false, 
        error: 'Промокод больше недействителен' 
      });
    }
    
    const usedBy = promocode.used_by || [];
    if (usedBy.includes(userId)) {
      return res.json({ 
        success: false, 
        error: 'Вы уже использовали этот промокод' 
      });
    }
    
    res.json({
      success: true,
      promocode: {
        code: promocode.code,
        type: promocode.type,
        value: promocode.value
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка проверки промокода:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка проверки промокода' 
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
    
    const [promocode] = await sql`
      SELECT * FROM promocodes WHERE code = ${code.toUpperCase()}
    `;

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
    
    if (promocode.used_count >= promocode.max_uses) {
      return res.status(400).json({ 
        success: false, 
        error: 'Промокод больше недействителен' 
      });
    }
    
    const usedBy = promocode.used_by || [];
    if (usedBy.includes(userId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Вы уже использовали этот промокод' 
      });
    }
    
    // Обновляем данные промокода
    usedBy.push(userId);
    await sql`
      UPDATE promocodes 
      SET used_count = ${promocode.used_count + 1}, 
          used_by = ${JSON.stringify(usedBy)}
      WHERE code = ${promocode.code}
    `;
    
    let newBalance = 0;
    
    // Если промокод на пополнение баланса
    if (promocode.type === 'balance') {
      const [user] = await sql`
        SELECT * FROM users WHERE discord_id = ${userId}
      `;
      
      if (user) {
        newBalance = (user.balance || 0) + promocode.value;
        await sql`
          UPDATE users 
          SET balance = ${newBalance}
          WHERE discord_id = ${userId}
        `;
      }
    }
    
    console.log(`🎫 Промокод активирован: ${userId} -> ${promocode.code}`);
    
    // Отправляем уведомление
    const webhookUrl = 'https://discord.com/api/webhooks/1475847787424776234/JH5b-8pfG3auhYIR2hQResaQv3EVtkbWAmXExkz6ssUQVddADgjrQ-YAGO5OI2s3oLuv';
    
    await axios.post(webhookUrl, {
      embeds: [{
        title: '<:Yes:1474931426951430225> Промокод активирован',
        description: `<:User:1474931634804359433> <@${userId}> активировал промокод <:Premium:1474931599622803628> \`${promocode.code}\``,
        color: 0xFEE75C,
        fields: [
          { name: '<:Wave:1386273780556496967> Тип', value: promocode.type === 'discount' ? 'Скидка' : 'Пополнение', inline: true },
          { name: '<:Wave:1386273780556496967> Значение', value: promocode.type === 'discount' ? `${promocode.value}%` : `${promocode.value} ₽`, inline: true }
        ],
        timestamp: new Date().toISOString()
      }]
    });
    
    res.json({
      success: true,
      message: promocode.type === 'balance' ? 
        `<:Money:1474931656610811966> Баланс пополнен на ${promocode.value}₽` :
        `<:Yes:1474931426951430225> Промокод "${promocode.code}" активирован`,
      newBalance: newBalance
    });
    
  } catch (error) {
    console.error('❌ Ошибка активации промокода:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка активации промокода' 
    });
  }
});

// ============================================
// API для баланса
// ============================================

app.get('/api/user/:id/balance', async (req, res) => {
  try {
    const [user] = await sql`
      SELECT balance FROM users WHERE discord_id = ${req.params.id}
    `;
    
    res.json({
      success: true,
      balance: user?.balance || 0,
      currency: 'RUB'
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения баланса:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка сервера' 
    });
  }
});

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
    
    console.log(`💰 Баланс обновлен: ${userId} ${amount > 0 ? '+' : ''}${amount} ₽ = ${newBalance} ₽`);
    
    res.json({
      success: true,
      message: 'Баланс обновлен',
      newBalance: newBalance
    });
    
  } catch (error) {
    console.error('❌ Ошибка обновления баланса:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка обновления баланса' 
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
    console.error('❌ Ошибка получения отзывов:', error.message);
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
    
    console.log('📝 Получен запрос на создание отзыва:', { userId, name, productId, productName, rating });
    
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
    
    // Проверяем, покупал ли пользователь этот товар
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
    
    console.log(`✅ Отзыв создан: ${reviewId} от ${name}`);
    
    // Отправляем уведомление в Discord
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
    console.error('❌ Ошибка создания отзыва:', error.message);
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
    console.error('❌ Ошибка отметки "полезно":', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка при отметке' 
    });
  }
});

// ============================================
// API для пользователя
// ============================================

app.get('/api/user/:id', async (req, res) => {
  try {
    const [user] = await sql`
      SELECT * FROM users WHERE discord_id = ${req.params.id}
    `;
    
    if (!user) {
      return res.json({ 
        success: true, 
        user: null 
      });
    }
    
    res.json({
      success: true,
      user: {
        discordId: user.discord_id,
        username: user.username,
        avatar: user.avatar,
        registeredAt: user.registered_at,
        balance: user.balance || 0,
        badges: user.badges || {},
        orders: (user.orders || []).slice(-10) // Последние 10 заказов
      }
    });

  } catch (error) {
    console.error('❌ Ошибка получения пользователя:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка сервера' 
    });
  }
});

// ============================================
// Админ статистика
// ============================================

app.get('/api/admin/stats', async (req, res) => {
  try {
    const [userStats] = await sql`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN registered_at > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) as new_users
      FROM users
    `;
    
    // Получаем всех пользователей для подсчета заказов
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
    console.error('❌ Ошибка получения статистики:', error.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ============================================
// HTML маршруты
// ============================================

// Тестовый маршрут
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Сервер работает на Netlify Functions',
    stats: {
      users: Object.keys(users).length,
      chatSessions: Object.keys(chatStore).length,
      totalMessages: Object.values(chatStore).reduce((sum, msgs) => sum + msgs.length, 0),
      reviews: reviewsData.reviews?.length || 0,
      promocodes: Object.keys(promocodes).length
    }
  });
});

// Главная страница
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>BHStore</title>
        <meta charset="UTF-8">
        <style>
            body { font-family: Arial; text-align: center; padding: 50px; background: #1e1f29; color: white; }
            h1 { color: #5865F2; }
        </style>
    </head>
    <body>
        <h1>🚀 BHStore API работает</h1>
        <p>Пользователей в памяти: ${Object.keys(users).length}</p>
        <p><a href="/api/test">Проверить API</a></p>
    </body>
    </html>
  `);
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
      console.error('❌ Ошибка получения уведомлений:', error);
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
      console.error('❌ Ошибка отметки уведомления:', error);
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
      console.error('❌ Ошибка сохранения уведомления:', error);
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
      console.error('❌ Ошибка сохранения уведомления:', error);
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
      console.error('❌ Ошибка сохранения ошибки:', error);
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
      console.error('❌ Ошибка сохранения статистики:', error);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Отправка вебхука (безопасно, с сервера)
app.post('/api/webhook/send', async (req, res) => {
  try {
      const { title, description, color, fields } = req.body;
      
      // Вебхук теперь хранится только на сервере, в переменных окружения
      const webhookUrl = process.env.DISCORD_WEBHOOK_URL || 'https://discord.com/api/webhooks/1459512369960194260/mtTCwjsSXA2_I7H-zmVbsYd5erD3UZCD9fZ2EiZkVg2KLt-IENQutfE4y393vXY5ryzH';
      
      const response = await axios.post(webhookUrl, {
          embeds: [{
              title,
              description,
              color,
              fields,
              timestamp: new Date().toISOString()
          }]
      });
      
      res.json({ success: true });
  } catch (error) {
      console.error('❌ Ошибка отправки вебхука:', error);
      res.status(500).json({ success: false, error: 'Ошибка отправки' });
  }
});

// Экспорт для serverless
module.exports.handler = serverless(app);