// telegram-auth.js - Защищённая версия
(function(){
    'use strict';
    
    // Защита от перехвата консоли
    const consoleLog = console.log;
    const consoleError = console.error;
    const consoleWarn = console.warn;
    
    // Отключаем вывод чувствительных данных в продакшене
    if(window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1')){
        console.log = function(){};
        console.error = function(){};
        console.warn = function(){};
    }
    
    // Защита от изменения прототипов
    Object.freeze(Object.prototype);
    Object.freeze(Array.prototype);
    
    // Функция для проверки целостности кода
    function checkIntegrity() {
        const checksum = document.querySelector('script[src*="telegram-auth"]')?.innerHTML?.length || 0;
        return checksum > 1000;
    }
    
    class TelegramAuthSecure {
        constructor() {
            this._token = null;
            this._tempData = new WeakMap();
            this._initTime = Date.now();
            this._maxAttempts = 3;
            this._attempts = 0;
            
            if(!checkIntegrity()) {
                alert('Ошибка безопасности');
                return;
            }
            
            this._init();
        }
        
        showModal() {
            this._showModal();
        }
        
        closeModal() {
            const modal = document.getElementById('telegramAuthModal');
            if (modal) modal.remove();
        }
        
        async _init() {
            await this._checkBotStatus();
            this._setupEventListeners();
        }

        async _checkBotStatus() {
            try {
                const response = await fetch('/api/telegram/status', {
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });
                const data = await response.json();
                if(data.success) {
                    const statusDiv = document.getElementById('telegramStatus');
                    if(statusDiv) statusDiv.innerHTML = '<i class="fas fa-check-circle" style="color:#57F287"></i> Бот активен';
                }
            } catch(e) {}
        }
        
        _setupEventListeners() {
            const modal = document.getElementById('telegramAuthModal');
            if(modal) return;
            
            const btn = document.getElementById('telegramAuthBtn');
            if(btn) btn.addEventListener('click', () => this._showModal());
        }
        
        _showModal() {
            if(this._attempts >= this._maxAttempts) {
                alert('Превышен лимит попыток. Попробуйте позже.');
                return;
            }
            
            const existingModal = document.getElementById('telegramAuthModal');
            if(existingModal) existingModal.remove();
            
            const modal = document.createElement('div');
            modal.id = 'telegramAuthModal';
            modal.className = 'modal';
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;justify-content:center;align-items:center;z-index:10001';
            
            modal.innerHTML = this._getModalHTML();
            document.body.appendChild(modal);
            
            this._bindModalEvents();
        }
        
        _getModalHTML() {
            return `
                <div style="max-width:450px;width:90%;background:#2a2b36;border-radius:20px;overflow:hidden">
                    <div style="padding:20px;background:#1e1f29;border-bottom:1px solid #40444b;display:flex;justify-content:space-between;align-items:center">
                        <h2 style="margin:0;color:white"><i class="fab fa-telegram"></i> Вход через Telegram</h2>
                        <button onclick="document.getElementById('telegramAuthModal')?.remove()" style="background:none;border:none;color:#b9bbbe;font-size:1.5rem;cursor:pointer">×</button>
                    </div>
                    <div style="padding:20px">
                        <div id="telegramStatus" style="margin-bottom:15px;padding:10px;border-radius:8px;background:#1e1f29;text-align:center">Проверка...</div>
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
        }
        
        _bindModalEvents() {
            const sendBtn = document.getElementById('sendTelegramCodeBtn');
            const verifyBtn = document.getElementById('verifyTelegramCodeBtn');
            const backBtn = document.getElementById('backToStep1Btn');
            
            if(sendBtn) sendBtn.onclick = () => this._sendCode();
            if(verifyBtn) verifyBtn.onclick = () => this._verifyCode();
            if(backBtn) backBtn.onclick = () => this._goToStep1();
            
            const codeInput = document.getElementById('telegramCodeInput');
            if(codeInput) {
                codeInput.oninput = (e) => { e.target.value = e.target.value.replace(/\D/g,'').slice(0,6); };
                codeInput.onkeypress = (e) => { if(e.key === 'Enter') this._verifyCode(); };
            }
        }
        
        _goToStep1() {
            document.getElementById('step1').style.display = 'block';
            document.getElementById('step2').style.display = 'none';
        }
        
        _goToStep2() {
            document.getElementById('step1').style.display = 'none';
            document.getElementById('step2').style.display = 'block';
            setTimeout(() => document.getElementById('telegramCodeInput')?.focus(), 100);
        }
        
        async _sendCode() {
            console.log('📱 _sendCode вызван');
            this._attempts++;
            
            const id = document.getElementById('telegramIdInput')?.value.trim();
            const name = document.getElementById('telegramNameInput')?.value.trim();
            
            console.log('📱 ID:', id, 'Name:', name);
            
            if(!id || !/^\d+$/.test(id)) {
                alert('Введите корректный Telegram ID (только цифры)');
                return;
            }
            if(!name) {
                alert('Введите ваше имя');
                return;
            }
            
            const btn = document.getElementById('sendTelegramCodeBtn');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
            
            try {
                console.log('📱 Отправка запроса на /api/telegram/send-code');
                
                const response = await fetch('/api/telegram/send-code', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': this._getCSRFToken(),
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify({ id, name })
                });
                
                console.log('📱 Статус ответа:', response.status);
                
                const data = await response.json();
                console.log('📱 Ответ сервера:', data);
                
                if(data.success) {
                    this._tempData.set(this, { id, name });
                    this._goToStep2();
                } else {
                    alert(data.error || 'Ошибка отправки');
                }
            } catch(e) {
                console.error('❌ Ошибка:', e);
                alert('Ошибка соединения: ' + e.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = 'Отправить код';
            }
        }
        
        async _verifyCode() {
            const code = document.getElementById('telegramCodeInput')?.value.trim();
            const temp = this._tempData.get(this);
            
            if(!code || code.length !== 6) {
                alert('Введите 6-значный код');
                return;
            }
            if(!temp) {
                alert('Сессия истекла. Начните заново');
                return;
            }
            
            const btn = document.getElementById('verifyTelegramCodeBtn');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Проверка...';
            
            try {
                const response = await fetch('/api/auth/telegram', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': this._getCSRFToken()
                    },
                    body: JSON.stringify({ 
                        code, 
                        id: temp.id, 
                        name: temp.name 
                    })
                });
                
                const data = await response.json();
                
                if(data.success) {
                    localStorage.setItem('_a', btoa(JSON.stringify(data.user)));
                    localStorage.setItem('_t', data.token);
                    
                    alert('Вход выполнен!');
                    document.getElementById('telegramAuthModal')?.remove();
                    window.location.href = '/profile.html';
                } else {
                    alert(data.error || 'Неверный код');
                }
            } catch(e) {
                alert('Ошибка проверки');
            } finally {
                btn.disabled = false;
                btn.innerHTML = 'Подтвердить';
            }
        }
        
        _getCSRFToken() {
            return document.cookie.split(';').find(c => c.trim().startsWith('csrf='))?.split('=')[1] || '';
        }
    }
    
    const telegramAuthInstance = new TelegramAuthSecure();
    window.telegramAuth = telegramAuthInstance;
    window._tgAuth = telegramAuthInstance; // резервное имя
    
    console.log('✅ Telegram Auth инициализирован, window.telegramAuth доступен');
})();