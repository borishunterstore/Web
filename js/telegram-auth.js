// telegram-auth.js - ПОЛНОСТЬЮ ИСПРАВЛЕННАЯ ВЕРСИЯ
(function(){
    'use strict';
    
    class TelegramAuth {
        constructor() {
            this.tempData = null;
            this.init();
        }
        
        init() {
            console.log('📱 Telegram Auth загружен');
            this.checkBotStatus();
            this.setupGlobalButton();
        }
        
        async checkBotStatus() {
            try {
                const response = await fetch('/api/telegram/status');
                const data = await response.json();
                if(data.success) {
                    console.log('✅ Telegram бот активен');
                }
            } catch(e) {
                console.error('Ошибка проверки бота:', e);
            }
        }
        
        setupGlobalButton() {
            const btn = document.getElementById('telegramAuthBtn');
            if(btn) {
                // Удаляем старые обработчики
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.showModal();
                });
            }
        }
        
        showModal() {
            // Удаляем старую модалку
            const existingModal = document.getElementById('telegramAuthModal');
            if(existingModal) existingModal.remove();
            
            // Создаём модалку
            const modal = document.createElement('div');
            modal.id = 'telegramAuthModal';
            modal.className = 'modal';
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;justify-content:center;align-items:center;z-index:10001';
            
            modal.innerHTML = `
                <div style="max-width:450px;width:90%;background:#2a2b36;border-radius:20px;overflow:hidden">
                    <div style="padding:20px;background:#1e1f29;border-bottom:1px solid #40444b;display:flex;justify-content:space-between;align-items:center">
                        <h2 style="margin:0;color:white"><i class="fab fa-telegram"></i> Вход через Telegram</h2>
                        <button onclick="document.getElementById('telegramAuthModal')?.remove()" style="background:none;border:none;color:#b9bbbe;font-size:1.5rem;cursor:pointer">×</button>
                    </div>
                    <div style="padding:20px">
                        <div id="telegramStatus" style="margin-bottom:15px;padding:10px;border-radius:8px;background:#1e1f29;text-align:center">Проверка бота...</div>
                        <div id="step1">
                            <input type="text" id="telegramIdInput" placeholder="Telegram ID" style="width:100%;padding:12px;margin-bottom:15px;background:#1e1f29;border:1px solid #40444b;border-radius:8px;color:white">
                            <input type="text" id="telegramNameInput" placeholder="Ваше имя" style="width:100%;padding:12px;margin-bottom:15px;background:#1e1f29;border:1px solid #40444b;border-radius:8px;color:white">
                            <button id="sendTelegramCodeBtn" style="width:100%;background:#26A5E4;border:none;padding:14px;border-radius:8px;color:white;font-weight:600;cursor:pointer">Отправить код</button>
                        </div>
                        <div id="step2" style="display:none">
                            <input type="text" id="telegramCodeInput" maxlength="6" placeholder="6-значный код" style="width:100%;padding:12px;margin-bottom:15px;background:#1e1f29;border:1px solid #40444b;border-radius:8px;color:white;text-align:center;font-size:1.2rem">
                            <button id="verifyTelegramCodeBtn" style="width:100%;background:#57F287;border:none;padding:14px;border-radius:8px;color:#1e1f29;font-weight:600;cursor:pointer">Подтвердить</button>
                            <button id="backToStep1Btn" style="width:100%;background:none;border:none;padding:10px;color:#5865F2;cursor:pointer;margin-top:10px">Назад</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Обновляем статус бота
            this.updateBotStatusDisplay();
            
            // ПРИВЯЗЫВАЕМ ОБРАБОТЧИКИ (ГЛАВНОЕ!)
            this.bindEvents();
        }
        
        async updateBotStatusDisplay() {
            const statusDiv = document.getElementById('telegramStatus');
            if(!statusDiv) return;
            
            try {
                const response = await fetch('/api/telegram/status');
                const data = await response.json();
                if(data.success) {
                    statusDiv.innerHTML = '<i class="fas fa-check-circle" style="color:#57F287"></i> Бот активен';
                } else {
                    statusDiv.innerHTML = '<i class="fas fa-exclamation-circle" style="color:#ED4245"></i> Бот неактивен';
                }
            } catch(e) {
                statusDiv.innerHTML = '<i class="fas fa-exclamation-circle" style="color:#ED4245"></i> Ошибка подключения';
            }
        }
        
        bindEvents() {
            // Кнопка отправки кода
            const sendBtn = document.getElementById('sendTelegramCodeBtn');
            if(sendBtn) {
                // Удаляем старый обработчик через замену
                const newSendBtn = sendBtn.cloneNode(true);
                sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
                newSendBtn.onclick = (e) => {
                    e.preventDefault();
                    console.log('📱 Отправка кода');
                    this.sendCode();
                };
            } else {
                console.error('❌ Кнопка sendTelegramCodeBtn не найдена');
            }
            
            // Кнопка подтверждения
            const verifyBtn = document.getElementById('verifyTelegramCodeBtn');
            if(verifyBtn) {
                const newVerifyBtn = verifyBtn.cloneNode(true);
                verifyBtn.parentNode.replaceChild(newVerifyBtn, verifyBtn);
                newVerifyBtn.onclick = (e) => {
                    e.preventDefault();
                    console.log('📱 Подтверждение кода');
                    this.verifyCode();
                };
            }
            
            // Кнопка назад
            const backBtn = document.getElementById('backToStep1Btn');
            if(backBtn) {
                const newBackBtn = backBtn.cloneNode(true);
                backBtn.parentNode.replaceChild(newBackBtn, backBtn);
                newBackBtn.onclick = (e) => {
                    e.preventDefault();
                    this.goToStep1();
                };
            }
            
            // Поле ввода кода
            const codeInput = document.getElementById('telegramCodeInput');
            if(codeInput) {
                codeInput.oninput = (e) => { e.target.value = e.target.value.replace(/\D/g,'').slice(0,6); };
                codeInput.onkeypress = (e) => { if(e.key === 'Enter') this.verifyCode(); };
            }
        }
        
        goToStep1() {
            document.getElementById('step1').style.display = 'block';
            document.getElementById('step2').style.display = 'none';
        }
        
        goToStep2() {
            document.getElementById('step1').style.display = 'none';
            document.getElementById('step2').style.display = 'block';
            setTimeout(() => {
                const codeInput = document.getElementById('telegramCodeInput');
                if(codeInput) codeInput.focus();
            }, 100);
        }
        
        async sendCode() {
            const id = document.getElementById('telegramIdInput')?.value.trim();
            const name = document.getElementById('telegramNameInput')?.value.trim();
            
            console.log('📱 sendCode:', { id, name });
            
            if(!id || !/^\d+$/.test(id)) {
                alert('Введите корректный Telegram ID (только цифры)');
                return;
            }
            if(!name) {
                alert('Введите ваше имя');
                return;
            }
            
            const btn = document.getElementById('sendTelegramCodeBtn');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
            
            try {
                const response = await fetch('/api/telegram/send-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, name })
                });
                
                const data = await response.json();
                console.log('📱 Ответ:', data);
                
                if(data.success) {
                    this.tempData = { id, name };
                    this.goToStep2();
                    alert('✅ Код отправлен в Telegram!');
                } else {
                    alert('❌ ' + (data.error || 'Ошибка отправки'));
                }
            } catch(e) {
                console.error('❌ Ошибка:', e);
                alert('❌ Ошибка соединения');
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }
        
        async verifyCode() {
            const code = document.getElementById('telegramCodeInput')?.value.trim();
            
            console.log('📱 verifyCode:', { code, tempData: this.tempData });
            
            if(!code || code.length !== 6) {
                alert('Введите 6-значный код');
                return;
            }
            if(!this.tempData) {
                alert('Сессия истекла. Начните заново');
                return;
            }
            
            const btn = document.getElementById('verifyTelegramCodeBtn');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Проверка...';
            
            try {
                const response = await fetch('/api/auth/telegram', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        code, 
                        id: this.tempData.id, 
                        name: this.tempData.name 
                    })
                });
                
                const data = await response.json();
                console.log('📱 Ответ:', data);
                
                if(data.success) {
                    localStorage.setItem('bhstore_auth', JSON.stringify({
                        id: data.user.id,
                        username: data.user.username,
                        email: data.user.email,
                        token: data.token,
                        authMethod: 'telegram'
                    }));
                    
                    alert('✅ Вход выполнен!');
                    document.getElementById('telegramAuthModal')?.remove();
                    window.location.href = '/profile.html';
                } else {
                    alert('❌ ' + (data.error || 'Неверный код'));
                }
            } catch(e) {
                console.error('❌ Ошибка:', e);
                alert('❌ Ошибка проверки');
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }
    }
    
    // СОЗДАЁМ ЭКЗЕМПЛЯР
    window.telegramAuth = new TelegramAuth();
    console.log('✅ Telegram Auth инициализирован');
})();