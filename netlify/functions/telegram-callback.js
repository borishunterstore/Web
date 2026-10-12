// netlify/functions/telegram-callback.js
const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// ✅ Строгая проверка JWT_SECRET — без fallback
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('❌ КРИТИЧНО: JWT_SECRET не задан или короче 32 символов!');
  console.error('Установите JWT_SECRET в Netlify → Site settings → Environment variables');
  // Не выбрасываем ошибку на этапе require, чтобы функция не падала полностью,
  // но при попытке подписать токен будет ошибка
}

const RECAPTCHA_SITE_KEY = process.env.RECAPTCHA_SITE_KEY || '6LfunBMtAAAAAERlHV1wjXssrw5yYmgPUmxvVUAQ';

let sql;
try {
  if (process.env.DATABASE_URL) {
    sql = neon(process.env.DATABASE_URL);
    console.log('✅ Подключено к БД');
  } else {
    console.warn('⚠️ DATABASE_URL не задан');
  }
} catch (error) {
  console.error('❌ Ошибка подключения к БД:', error.message);
  sql = null;
}

exports.handler = async (event, context) => {
  const { token, telegram_id, username, name } = event.queryStringParameters || {};
  
  console.log('🔐 Telegram callback получен:', { token, telegram_id });
  
  if (!token || !telegram_id) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
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
      console.log('📋 Сессия найдена:', !!session);
    } catch (dbError) {
      console.error('❌ Ошибка проверки сессии:', dbError.message);
    }
  }
  
  if (!session) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><title>Ошибка</title></head>
<body style="background:#1e1f29;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif">
  <div style="text-align:center;background:#2a2b36;padding:40px;border-radius:20px">
    <h2 style="color:#ED4245">❌ Сессия истекла или не найдена</h2>
    <p>Пожалуйста, запросите новую ссылку на сайте</p>
    <a href="/auth.html" style="color:#5865F2">Вернуться</a>
  </div>
</body>
</html>`
    };
  }
  
  const userId = `tg_${telegram_id}`;
  const userDisplayName = decodeURIComponent(name || username || `Telegram_${telegram_id}`);
  
  // Экранирование для HTML
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      if (m === '"') return '&quot;';
      if (m === "'") return '&#039;';
      return m;
    });
  }
  
  const safeToken = escapeHtml(token);
  const safeTelegramId = escapeHtml(String(telegram_id));
  const safeUsername = escapeHtml(username || '');
  const safeName = escapeHtml(userDisplayName);
  
  const html = `<!DOCTYPE html>
<html lang="ru">
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
    }
    input:focus { outline: none; border-color: #5865F2; }
    .info-box {
      background: #1e1f29;
      padding: 15px;
      border-radius: 12px;
      margin-bottom: 20px;
      border-left: 3px solid #57F287;
    }
    .info-box p { margin: 5px 0; color: #b9bbbe; font-size: 0.85rem; }
    .info-box strong { color: white; }
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
      margin-top: 10px;
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .error-message { color: #ED4245; font-size: 0.85rem; margin-top: 5px; display: none; }
    .success-message { color: #57F287; text-align: center; margin-top: 15px; display: none; }
    .optional { color: #72767d; font-size: 0.75rem; margin-top: 4px; }
    .required { color: #ED4245; }
  </style>
</head>
<body>
  <div class="container">
    <h2>🔐 Завершение регистрации</h2>
    
    <div class="info-box">
      <p><strong>👤 Telegram аккаунт</strong></p>
      <p>ID: <code>${safeTelegramId}</code></p>
      <p>Имя: ${safeName}</p>
    </div>
    
    <form id="registerForm">
      <div class="form-group">
        <label>📧 Электронная почта <span class="optional">(необязательно)</span></label>
        <input type="email" id="email" placeholder="example@mail.com">
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
    const token = ${JSON.stringify(safeToken)};
    const telegramId = ${JSON.stringify(safeTelegramId)};
    const username = ${JSON.stringify(safeUsername)};
    const name = ${JSON.stringify(safeName)};
    
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
        const recaptchaToken = await grecaptcha.execute('${RECAPTCHA_SITE_KEY}', { action: 'register' });
        
        const response = await fetch('/api/auth/telegram/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: token,
            telegram_id: telegramId,
            username: username,
            name: name,
            email: email || null,
            password: password,
            recaptchaToken: recaptchaToken
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
  </script>
</body>
</html>`;
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: html
  };
};