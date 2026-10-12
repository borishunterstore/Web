// telegram-auth.js - упрощённая версия
(function(){
    'use strict';
    
    class TelegramAuth {
        constructor() {
            this.init();
        }
        
        init() {
            console.log('📱 Telegram Auth загружен');
            this.setupButton();
        }
        
        setupButton() {
            const btn = document.getElementById('telegramAuthBtn');
            if(btn) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.redirectToBot();
                });
            }
        }
        
        redirectToBot() {
            // Генерируем случайный токен
            const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            
            // Сохраняем токен в localStorage для проверки
            localStorage.setItem('telegram_auth_token', token);
            
            // Открываем бота
            window.open(`https://t.me/Meentioned_bot?start=${token}`, '_blank');
            
            // Показываем сообщение
            alert('📱 Открыт Telegram бот!\n\n1. Нажмите "ВОЙТИ В АККАУНТ"\n2. Нажмите "ПЕРЕЙТИ К АВТОРИЗАЦИИ"\n3. Нажмите "ПОДТВЕРДИТЬ ВХОД"');
        }
    }
    
    window.telegramAuth = new TelegramAuth();
    console.log('✅ Telegram Auth инициализирован');
})();