// netlify/functions/telegram-callback.js
const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'bhstore-super-secret-key-2024-change-this';

let sql;
try {
  if (process.env.DATABASE_URL) {
    sql = neon(process.env.DATABASE_URL);
    console.log('✅ Подключено к БД');
  }
} catch (error) {
  console.error('❌ Ошибка подключения к БД:', error.message);
  sql = null;
}

exports.handler = async (event, context) => {
  const { token, telegram_id, username, name } = event.queryStringParameters || {};
  
  console.log('🔐 Telegram callback получен:', { token, telegram_id, username, name });
  
  if (!token || !telegram_id) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html' },
      body: '<h1>Ошибка: недостаточно параметров</h1>'
    };
  }
  
  // Проверяем сессию в БД
  let session = null;
  if (sql) {
    try {
      const [row] = await sql`
        SELECT * FROM auth_sessions WHERE token = ${token} AND expires_at > NOW()
      `;
      session = row;
      console.log('📋 Сессия найдена:', session);
    } catch (dbError) {
      console.error('❌ Ошибка проверки сессии:', dbError.message);
    }
  }
  
  if (!session) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html' },
      body: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>Ошибка</title></head>
        <body style="background:#1e1f29;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif">
          <div style="text-align:center;background:#2a2b36;padding:40px;border-radius:20px">
            <h2 style="color:#ED4245">❌ Сессия истекла или не найдена</h2>
            <p>Пожалуйста, запросите новую ссылку на сайте</p>
            <a href="/auth.html" style="color:#5865F2">Вернуться</a>
          </div>
        </body>
        </html>
      `
    };
  }
  
  const userId = `tg_${telegram_id}`;
  const userDisplayName = decodeURIComponent(name || username || `Telegram_${telegram_id}`);
  
  const userData = {
    id: userId,
    username: userDisplayName,
    avatar: null,
    email: `${userId}@telegram.bhstore`,
    authMethod: 'telegram'
  };
  
  // Сохраняем или обновляем пользователя в БД
  if (sql) {
    try {
      const [existing] = await sql`SELECT * FROM users WHERE discord_id = ${userId}`;
      if (!existing) {
        await sql`
          INSERT INTO users (discord_id, username, email, avatar, balance, badges, frozen, privacy)
          VALUES (${userId}, ${userDisplayName}, ${userData.email}, NULL, 0, '{}', false, '{"show_avatar":true,"show_orders":true,"show_badges":true,"show_spent":true,"show_orders_count":true,"show_registered":true,"hide_profile":false}')
        `;
        console.log(`✅ Новый Telegram пользователь: ${userId}`);
      } else {
        await sql`
          UPDATE users 
          SET username = ${userDisplayName}, 
              email = ${userData.email}
          WHERE discord_id = ${userId}
        `;
        console.log(`✅ Telegram пользователь обновлён: ${userId}`);
      }
    } catch (dbError) {
      console.error('❌ Ошибка сохранения пользователя:', dbError.message);
    }
  }
  
  // Создаём JWT токен
  const jwtToken = jwt.sign(
    { ...userData },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  // Удаляем использованную сессию
  if (sql) {
    try {
      await sql`DELETE FROM auth_sessions WHERE token = ${token}`;
      console.log(`🗑️ Сессия ${token} удалена`);
    } catch (dbError) {
      console.error('❌ Ошибка удаления сессии:', dbError.message);
    }
  }
  
  // HTML страница с перенаправлением
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Авторизация BHStore</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: linear-gradient(135deg, #0f172a 0%, #0a0a0f 100%);
          color: white;
          font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          padding: 20px;
        }
        .container {
          text-align: center;
          background: rgba(42, 43, 54, 0.95);
          backdrop-filter: blur(10px);
          padding: 40px;
          border-radius: 24px;
          border: 1px solid #40444b;
          max-width: 400px;
          width: 100%;
        }
        .loader {
          width: 60px;
          height: 60px;
          border: 3px solid #40444b;
          border-top-color: #5865F2;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 20px auto;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        h2 { margin-bottom: 15px; }
        p { color: #b9bbbe; margin-top: 15px; }
        .success { color: #57F287; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="loader"></div>
        <h2>🔐 Авторизация через Telegram</h2>
        <p>Вход выполняется...</p>
        <p class="success" id="status"></p>
      </div>
      <script>
        (function() {
          try {
            const authData = {
              id: '${userId}',
              username: '${userDisplayName.replace(/'/g, "\\'")}',
              email: '${userData.email}',
              token: '${jwtToken}',
              authMethod: 'telegram'
            };
            
            localStorage.setItem('bhstore_auth', JSON.stringify(authData));
            console.log('✅ Авторизация успешна, перенаправление...');
            
            const statusEl = document.getElementById('status');
            if (statusEl) statusEl.textContent = '✅ Вход выполнен! Перенаправление...';
            
            setTimeout(function() {
              window.location.href = '/profile.html';
            }, 1500);
          } catch (err) {
            console.error('Ошибка:', err);
            document.getElementById('status').textContent = '❌ Ошибка, обновите страницу';
          }
        })();
      </script>
    </body>
    </html>
  `;
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: html
  };
};