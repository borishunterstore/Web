// netlify/functions/telegram-callback.js
const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

let sql;
try {
  if (process.env.DATABASE_URL) {
    sql = neon(process.env.DATABASE_URL);
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
      body: '<h1>Ошибка: недостаточно параметров</h1>'
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
  
  // Сохраняем пользователя в БД
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
      console.error('Ошибка БД:', dbError.message);
    }
  }
  
  // Создаём JWT токен
  const jwtToken = Buffer.from(JSON.stringify({
    ...userData,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000
  })).toString('base64');
  
  // HTML страница
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
          font-family: system-ui, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
        }
        .container {
          text-align: center;
          background: rgba(42, 43, 54, 0.95);
          padding: 40px;
          border-radius: 24px;
          max-width: 400px;
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
        p { color: #b9bbbe; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="loader"></div>
        <h2>🔐 Авторизация через Telegram</h2>
        <p>Вход выполняется...</p>
      </div>
      <script>
        localStorage.setItem('bhstore_auth', JSON.stringify({
          id: '${userId}',
          username: '${userDisplayName.replace(/'/g, "\\'")}',
          email: '${userData.email}',
          token: '${jwtToken}',
          authMethod: 'telegram'
        }));
        setTimeout(() => { window.location.href = '/profile.html'; }, 1500);
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