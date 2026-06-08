// netlify/functions/telegram-callback.js
const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'bhstore-super-secret-key-2024-change-this';
const RECAPTCHA_SITE_KEY = '6LfunBMtAAAAAERlHV1wjXssrw5yYmgPUmxvVUAQ';

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
  
  // HTML страница с формой для ввода email и пароля
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Завершение регистрации | BHStore</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}"></script>
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
          margin-top: 10px;
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
        .required {
          color: #ED4245;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>🔐 Завершение регистрации</h2>
        
        <div class="info-box">
          <p><strong>👤 Telegram аккаунт</strong></p>
          <p>ID: <code>${telegram_id}</code></p>
          <p>Имя: ${escapeHtml(userDisplayName)}</p>
        </div>
        
        <form id="registerForm">
          <div class="form-group">
            <label>📧 Электронная почта <span class="optional">(необязательно)</span></label>
            <input type="email" id="email" placeholder="example@mail.com">
            <div class="optional">Если не указать, поле email останется пустым</div>
          </div>
          
          <div class="form-group">
            <label>🔒 Пароль <span class="required">*</span></label>
            <input type="password" id="password" required placeholder="Введите пароль" minlength="6">
            <div class="optional">Минимум 6 символов</div>
          </div>
          
          <div class="form-group">
            <label>🔒 Подтверждение пароля <span class="required">*</span></label>
            <input type="password" id="confirm_password" required placeholder="Повторите пароль">
          </div>
          
          <div id="errorMsg" class="error-message"></div>
          <div id="successMsg" class="success-message"></div>
          
          <button type="submit" id="submitBtn">Завершить регистрацию</button>
        </form>
      </div>
      
      <script>
        const token = '${token}';
        const telegramId = '${telegram_id}';
        const username = '${escapeHtml(username || '')}';
        const name = '${escapeHtml(userDisplayName)}';
        
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
          
          submitBtn.disabled = true;
          submitBtn.textContent = 'Обработка...';
          
          try {
            const response = await fetch('/api/auth/telegram/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: token,
                telegram_id: telegramId,
                username: username,
                name: name,
                email: email || null,
                password: password
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
            }
          } catch (err) {
            errorMsg.textContent = 'Ошибка сервера. Попробуйте позже.';
            errorMsg.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Завершить регистрацию';
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

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}