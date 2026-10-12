// js/telegram-auth.js
(function() {
    'use strict';
  
    let isProcessing = false;
    let pollTimer = null;
  
    async function startTelegramAuth() {
      if (isProcessing) return;
      isProcessing = true;
  
      const btn = document.getElementById('telegramAuthBtn');
      const originalHTML = btn ? btn.innerHTML : '';
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Создание сессии...';
      }
  
      try {
        // 1. Получаем reCAPTCHA-токен
        const recaptchaToken = await new Promise((resolve, reject) => {
          if (typeof grecaptcha === 'undefined') return reject(new Error('reCAPTCHA не загружена'));
          grecaptcha.ready(() => {
            grecaptcha.execute('6LfunBMtAAAAAERlHV1wjXssrw5yYmgPUmxvVUAQ', { action: 'telegram_login' })
              .then(resolve)
              .catch(reject);
          });
        });
  
        // 2. Создаём сессию
        const res = await fetch('/api/telegram/create-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recaptchaToken })
        });
        const data = await res.json();
  
        if (!data.success) throw new Error(data.error || 'Не удалось создать сессию');
  
        // 3. Открываем бота
        window.open(data.botLink, '_blank');
  
        if (btn) {
          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ожидание подтверждения в Telegram...';
        }
  
        // 4. Поллим статус сессии
        let seconds = 0;
        const maxSeconds = 300; // 5 минут
        pollTimer = setInterval(async () => {
          seconds += 3;
          if (seconds > maxSeconds) {
            clearInterval(pollTimer);
            isProcessing = false;
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
            alert('Время ожидания истекло. Попробуйте снова.');
            return;
          }
  
          try {
            const statusRes = await fetch(`/api/telegram/session-status?token=${encodeURIComponent(data.token)}`);
            const statusData = await statusRes.json();
  
            if (statusData.status === 'confirmed') {
              clearInterval(pollTimer);
              // Переходим на страницу завершения регистрации
              window.location.href = `/auth/telegram/callback?token=${encodeURIComponent(data.token)}&telegram_id=${encodeURIComponent(statusData.telegram_id)}&username=${encodeURIComponent(statusData.username || '')}&name=${encodeURIComponent(statusData.name || '')}`;
            } else if (statusData.status === 'expired') {
              clearInterval(pollTimer);
              isProcessing = false;
              if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
              alert('Сессия истекла. Попробуйте снова.');
            }
          } catch (e) {
            console.error('Poll error:', e);
          }
        }, 3000);
  
      } catch (err) {
        console.error('Telegram auth error:', err);
        alert('Ошибка: ' + err.message);
        isProcessing = false;
        if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
      }
    }
  
    window.startTelegramAuth = startTelegramAuth;
  
    document.addEventListener('DOMContentLoaded', () => {
      const btn = document.getElementById('telegramAuthBtn');
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          startTelegramAuth();
        });
      }
    });
  })();