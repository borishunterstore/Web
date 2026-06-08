// js/telegram-auth.js - упрощённая версия (не используется, оставлен для совместимости)
(function(){
  'use strict';
  
  class TelegramAuth {
      constructor() {
          console.log('📱 Telegram Auth загружен (reCAPTCHA version)');
      }
      
      showModal() {
          // Этот метод больше не используется, т.к. авторизация через reCAPTCHA
          console.log('Telegram auth через reCAPTCHA, используйте кнопку на странице');
      }
  }
  
  window.telegramAuth = new TelegramAuth();
  console.log('✅ Telegram Auth инициализирован (reCAPTCHA version)');
})();