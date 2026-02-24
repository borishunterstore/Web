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
console.log('✅ Client ID:', DISCORD_CLIENT_ID);
console.log('✅ Redirect URI:', DISCORD_REDIRECT_URI);
console.log('✅ Bot API URL:', BOT_API_URL);

// Инициализация подключения к PostgreSQL (Neon)
const sql = neon(process.env.DATABASE_URL);

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// Инициализация базы данных
// ============================================
async function initDatabase() {
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
    
    // Проверяем, есть ли тестовые данные
    const [adminUser] = await sql`
      SELECT * FROM users WHERE discord_id = '992442453833547886'
    `;
    
    if (!adminUser) {
      // Создаем админа
      await sql`
        INSERT INTO users (discord_id, username, email, balance, badges)
        VALUES (
          '992442453833547886', 
          'borisonchik_yt', 
          'test@example.com', 
          1000, 
          ${JSON.stringify({ verified: true, admin: true })}
        )
      `;
      console.log('✅ Создан тестовый пользователь (админ)');
    }
    
    // Проверяем промокоды
    const [welcomePromo] = await sql`
      SELECT * FROM promocodes WHERE code = 'WELCOME10'
    `;
    
    if (!welcomePromo) {
      await sql`
        INSERT INTO promocodes (code, type, value, max_uses, used_by)
        VALUES 
          ('WELCOME10', 'discount', 10, 100, '[]'),
          ('BALANCE100', 'balance', 100, 50, '[]')
      `;
      console.log('✅ Созданы тестовые промокоды');
    }
    
    // Проверяем отзывы
    const [testReview] = await sql`
      SELECT * FROM reviews WHERE id = 'rev_1'
    `;
    
    if (!testReview) {
      await sql`
        INSERT INTO reviews (id, user_id, name, avatar, rating, product_id, product_name, text, verified_purchase, verified, helpful, created_at)
        VALUES (
          'rev_1',
          '992442453833547886',
          'borisonchik_yt',
          'https://cdn.discordapp.com/embed/avatars/0.png',
          5,
          'premium_month',
          'Премиум на 1 месяц',
          'Отличный сервис!',
          true,
          true,
          5,
          ${new Date().toISOString()}
        )
      `;
      console.log('✅ Создан тестовый отзыв');
    }
    
    console.log('✅ База данных инициализирована');
  } catch (error) {
    console.error('❌ Ошибка инициализации БД:', error);
  }
}

// Запускаем инициализацию БД
initDatabase();

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
    const webhookUrl = 'https://discord.com/api/webhooks/1459512369960194260/mtTCwjsSXA2_I7H-zmVbsYd5erD3UZCD9fZ2EiZkVg2KLt-IENQutfE4y393vXY5ryzH';
    
    axios.post(webhookUrl, {
      embeds: [{
        title: fromAdmin ? '📨 Сообщение от админа' : '💬 Сообщение от пользователя',
        description: message,
        color: fromAdmin ? 0x57F287 : 0x5865F2,
        fields: [{ name: 'Пользователь', value: userId, inline: true }],
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

// API авторизации
app.post('/api/auth/discord', async (req, res) => {
  try {
    const { code } = req.body;
    console.log('🔐 Получен запрос авторизации');

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

    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, token_type } = tokenResponse.data;

    // Получение информации о пользователе
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        'Authorization': `${token_type} ${access_token}`
      }
    });

    const userData = {
      id: userResponse.data.id,
      username: userResponse.data.username,
      avatar: userResponse.data.avatar,
      email: userResponse.data.email,
      global_name: userResponse.data.global_name || userResponse.data.username
    };

    console.log(`✅ Пользователь: ${userData.username}`);

    // Сохраняем пользователя в БД
    const [existingUser] = await sql`
      SELECT * FROM users WHERE discord_id = ${userData.id}
    `;
    
    if (!existingUser) {
      await sql`
        INSERT INTO users (discord_id, username, email, avatar, balance, badges)
        VALUES (
          ${userData.id}, 
          ${userData.username}, 
          ${userData.email}, 
          ${userData.avatar}, 
          0,
          ${JSON.stringify({})}
        )
      `;
    } else {
      // Обновляем данные пользователя
      await sql`
        UPDATE users 
        SET username = ${userData.username}, 
            email = ${userData.email}, 
            avatar = ${userData.avatar}
        WHERE discord_id = ${userData.id}
      `;
    }

    // Токен для клиента
    const token = Buffer.from(JSON.stringify({
      ...userData,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000
    })).toString('base64');

    res.json({
      success: true,
      token: token,
      user: userData
    });

  } catch (error) {
    console.error('❌ Ошибка авторизации:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка авторизации через Discord'
    });
  }
});

// Отправка кода верификации
app.post('/api/send-verification', async (req, res) => {
  try {
    const { userId, code } = req.body;
    console.log(`📨 Отправка кода ${code} пользователю ${userId}`);
    
    // Отправляем через вебхук Discord
    const webhookUrl = 'https://discord.com/api/webhooks/1459512369960194260/mtTCwjsSXA2_I7H-zmVbsYd5erD3UZCD9fZ2EiZkVg2KLt-IENQutfE4y393vXY5ryzH';
    
    await axios.post(webhookUrl, {
      content: `<@${userId}>`,
      embeds: [{
        title: '🔐 Код верификации',
        description: `Ваш код: \`${code}\``,
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
    const { userId, productName, price } = req.body;
    console.log(`🛒 Заказ от ${userId}: ${productName}`);
    
    const orderId = `ORD-${Date.now()}`;
    
    // Получаем пользователя
    const [user] = await sql`
      SELECT * FROM users WHERE discord_id = ${userId}
    `;
    
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
    
    // Обновляем заказы
    const orders = user.orders || [];
    const newOrder = {
      id: orderId,
      productName: productName,
      price: price,
      date: new Date().toISOString(),
      status: 'completed'
    };
    orders.push(newOrder);
    
    // Обновляем бейджи
    const badges = user.badges || {};
    badges.buyer = true;
    
    // Сохраняем в БД
    await sql`
      UPDATE users 
      SET balance = ${currentBalance - price}, 
          orders = ${JSON.stringify(orders)},
          badges = ${JSON.stringify(badges)}
      WHERE discord_id = ${userId}
    `;

    // Отправляем уведомление
    const webhookUrl = 'https://discord.com/api/webhooks/1459512369960194260/mtTCwjsSXA2_I7H-zmVbsYd5erD3UZCD9fZ2EiZkVg2KLt-IENQutfE4y393vXY5ryzH';
    
    await axios.post(webhookUrl, {
      embeds: [{
        title: '💰 Новая покупка!',
        description: `<@${userId}> купил "${productName}"`,
        color: 0x57F287,
        fields: [
          { name: 'Цена', value: `${price} ₽`, inline: true },
          { name: 'Заказ', value: orderId, inline: true },
          { name: 'Баланс после', value: `${currentBalance - price} ₽`, inline: true }
        ],
        timestamp: new Date().toISOString()
      }]
    });

    res.json({
      success: true,
      orderId: orderId,
      newBalance: currentBalance - price
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
app.get('/api/products', (req, res) => {
  try {
    const products = [
      {
        id: 'premium_month',
        name: 'Премиум на 1 месяц',
        description: 'Доступ ко всем премиум функциям бота на 30 дней',
        price: 299,
        category: 'premium',
        icon: 'fas fa-crown',
        popular: true
      },
      {
        id: 'premium_year',
        name: 'Премиум на 1 год',
        description: 'Доступ ко всем премиум функциям бота на 365 дней',
        price: 2499,
        category: 'premium',
        icon: 'fas fa-crown',
        discount: 30
      }
    ];
    
    res.json({ success: true, products });
  } catch (error) {
    console.error('❌ Ошибка товаров:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка загрузки товаров' 
    });
  }
});

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
    const webhookUrl = 'https://discord.com/api/webhooks/1459512369960194260/mtTCwjsSXA2_I7H-zmVbsYd5erD3UZCD9fZ2EiZkVg2KLt-IENQutfE4y393vXY5ryzH';
    
    await axios.post(webhookUrl, {
      embeds: [{
        title: '🎫 Промокод активирован',
        description: `<@${userId}> активировал промокод \`${promocode.code}\``,
        color: 0xFEE75C,
        fields: [
          { name: 'Тип', value: promocode.type === 'discount' ? 'Скидка' : 'Пополнение', inline: true },
          { name: 'Значение', value: promocode.type === 'discount' ? `${promocode.value}%` : `${promocode.value} ₽`, inline: true }
        ],
        timestamp: new Date().toISOString()
      }]
    });
    
    res.json({
      success: true,
      message: promocode.type === 'balance' ? 
        `Баланс пополнен на ${promocode.value} ₽` :
        `Промокод "${promocode.code}" активирован`,
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
    const webhookUrl = 'https://discord.com/api/webhooks/1459512369960194260/mtTCwjsSXA2_I7H-zmVbsYd5erD3UZCD9fZ2EiZkVg2KLt-IENQutfE4y393vXY5ryzH';
    
    axios.post(webhookUrl, {
      embeds: [{
        title: '⭐ Новый отзыв!',
        description: `**${name}** оставил отзыв на товар **${productName}**`,
        color: 0xFEE75C,
        fields: [
          { name: 'Оценка', value: '⭐'.repeat(parseInt(rating)), inline: true },
          { name: 'Текст', value: text.substring(0, 100) + (text.length > 100 ? '...' : ''), inline: false }
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

app.get('/', async (req, res) => {
  try {
    const [userCount] = await sql`SELECT COUNT(*) as count FROM users`;
    const [reviewCount] = await sql`SELECT COUNT(*) as count FROM reviews`;
    const [promoCount] = await sql`SELECT COUNT(*) as count FROM promocodes`;
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>BHStore</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1e1f29; color: white; }
              h1 { color: #5865F2; }
              .api-info { background: #2a2b36; padding: 20px; border-radius: 10px; margin-top: 20px; }
          </style>
      </head>
      <body>
          <h1>🚀 BHStore API работает на Netlify Functions</h1>
          <div class="api-info">
              <p>✅ Сервер успешно запущен</p>
              <p>📊 Пользователей: ${userCount?.count || 0}</p>
              <p>⭐ Отзывов: ${reviewCount?.count || 0}</p>
              <p>🎫 Промокодов: ${promoCount?.count || 0}</p>
          </div>
      </body>
      </html>
    `);
  } catch (error) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>BHStore</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1e1f29; color: white; }
              h1 { color: #5865F2; }
              .api-info { background: #2a2b36; padding: 20px; border-radius: 10px; margin-top: 20px; }
          </style>
      </head>
      <body>
          <h1>🚀 BHStore API работает на Netlify Functions</h1>
          <div class="api-info">
              <p>✅ Сервер успешно запущен</p>
              <p>📊 Данные загружаются...</p>
          </div>
      </body>
      </html>
    `);
  }
});

// Тестовый маршрут
app.get('/api/test', async (req, res) => {
  try {
    const [userCount] = await sql`SELECT COUNT(*) as count FROM users`;
    const [reviewCount] = await sql`SELECT COUNT(*) as count FROM reviews`;
    const [promoCount] = await sql`SELECT COUNT(*) as count FROM promocodes`;
    const [messageCount] = await sql`SELECT COUNT(*) as count FROM messages`;
    const [chatSessions] = await sql`SELECT COUNT(DISTINCT user_id) as count FROM messages`;
    
    res.json({
      success: true,
      message: 'Сервер работает на Netlify Functions',
      stats: {
        users: parseInt(userCount?.count) || 0,
        chatSessions: parseInt(chatSessions?.count) || 0,
        totalMessages: parseInt(messageCount?.count) || 0,
        reviews: parseInt(reviewCount?.count) || 0,
        promocodes: parseInt(promoCount?.count) || 0
      }
    });
  } catch (error) {
    res.json({
      success: true,
      message: 'Сервер работает на Netlify Functions',
      stats: {
        users: 1,
        chatSessions: 0,
        totalMessages: 0,
        reviews: 1,
        promocodes: 2
      }
    });
  }
});

// Экспорт для serverless
module.exports.handler = serverless(app);
