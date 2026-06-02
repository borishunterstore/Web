// telegram-auth.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
class TelegramAuth {
    constructor() {
        this.botToken = '6876007284:AAH5R2BCqS8RPafZWg5s_0v-DJfoiJsiQco';
        this.botUsername = '@Meentioned_bot';
        this.tempId = null;
        this.tempUsername = null;
        this.init();
    }

    init() {
        console.log('📱 Telegram Auth загружен');
        this.checkBotStatus();
    }

    async checkBotStatus() {
        try {
            const response = await fetch('/api/telegram/status');
            const data = await response.json();
            if (data.success) {
                console.log('✅ Telegram бот активен:', data.bot?.username);
            }
        } catch (error) {
            console.error('Ошибка проверки бота:', error);
        }
    }

    showModal() {
        const existingModal = document.getElementById('telegramAuthModal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'telegramAuthModal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); display: flex; justify-content: center; align-items: center; z-index: 10001; backdrop-filter: blur(8px);';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 450px; width: 90%; background: #2a2b36; border-radius: 20px; padding: 0; overflow: hidden;">
                <div style="padding: 20px; background: #1e1f29; border-bottom: 1px solid #40444b; display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="margin: 0; color: white;"><i class="fab fa-telegram"></i> Вход через Telegram</h2>
                    <button onclick="window.telegramAuth?.closeModal()" style="background: none; border: none; color: #b9bbbe; font-size: 1.5rem; cursor: pointer;">×</button>
                </div>
                
                <div style="padding: 20px;">
                    <div id="telegramStatus" style="margin-bottom: 15px; padding: 10px; border-radius: 8px; background: #1e1f29; text-align: center; font-size: 0.85rem;">
                        <i class="fas fa-spinner fa-spin"></i> Проверка бота...
                    </div>
                    
                    <!-- ШАГ 1: Ввод ID -->
                    <div id="step1">
                        <div class="form-group" style="margin-bottom: 15px;">
                            <label style="color: #b9bbbe; display: block; margin-bottom: 8px;">Ваш Telegram ID</label>
                            <input type="text" id="telegramIdInput" placeholder="Например: 123456789" style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
                            <small style="color: #72767d; display: block; margin-top: 5px;">Узнать ID можно у бота @userinfobot</small>
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 15px;">
                            <label style="color: #b9bbbe; display: block; margin-bottom: 8px;">Ваше имя</label>
                            <input type="text" id="telegramNameInput" placeholder="Как вас называть" style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
                        </div>
                        
                        <button id="sendTelegramCodeBtn" class="btn-telegram-send" style="width: 100%; background: #26A5E4; border: none; padding: 14px; border-radius: 8px; color: white; font-weight: 600; cursor: pointer;">
                            <i class="fab fa-telegram"></i> Отправить код
                        </button>
                    </div>
                    
                    <!-- ШАГ 2: Ввод кода -->
                    <div id="step2" style="display: none;">
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="color: #b9bbbe; display: block; margin-bottom: 8px;">Код подтверждения</label>
                            <input type="text" id="telegramCodeInput" placeholder="6-значный код" maxlength="6" style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white; text-align: center; font-size: 1.2rem; letter-spacing: 5px;">
                        </div>
                        
                        <button id="verifyTelegramCodeBtn" style="width: 100%; background: #57F287; border: none; padding: 14px; border-radius: 8px; color: #1e1f29; font-weight: 600; cursor: pointer;">
                            <i class="fas fa-check"></i> Подтвердить
                        </button>
                        
                        <button id="backToStep1Btn" style="width: 100%; background: none; border: none; padding: 10px; color: #5865F2; cursor: pointer; margin-top: 10px;">
                            <i class="fas fa-arrow-left"></i> Назад
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Обновляем статус
        this.updateBotStatusDisplay();
        
        // Назначаем обработчики
        document.getElementById('sendTelegramCodeBtn')?.addEventListener('click', () => this.sendCode());
        document.getElementById('verifyTelegramCodeBtn')?.addEventListener('click', () => this.verifyCode());
        document.getElementById('backToStep1Btn')?.addEventListener('click', () => this.goToStep1());
        
        // Enter на поле кода
        const codeInput = document.getElementById('telegramCodeInput');
        if (codeInput) {
            codeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.verifyCode();
            });
            codeInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
            });
        }
    }

    closeModal() {
        document.getElementById('telegramAuthModal')?.remove();
    }

    async updateBotStatusDisplay() {
        const statusDiv = document.getElementById('telegramStatus');
        if (!statusDiv) return;
        
        try {
            const response = await fetch('/api/telegram/status');
            const data = await response.json();
            if (data.success) {
                statusDiv.innerHTML = '<i class="fas fa-check-circle" style="color: #57F287;"></i> Бот активен';
                statusDiv.style.color = '#57F287';
            }
        } catch (error) {
            statusDiv.innerHTML = '<i class="fas fa-exclamation-circle" style="color: #ED4245;"></i> Ошибка';
        }
    }

    goToStep1() {
        document.getElementById('step1').style.display = 'block';
        document.getElementById('step2').style.display = 'none';
    }

    goToStep2() {
        document.getElementById('step1').style.display = 'none';
        document.getElementById('step2').style.display = 'block';
        
        const codeInput = document.getElementById('telegramCodeInput');
        if (codeInput) setTimeout(() => codeInput.focus(), 100);
    }

    async sendCode() {
        const telegramId = document.getElementById('telegramIdInput')?.value.trim();
        const username = document.getElementById('telegramNameInput')?.value.trim();
        
        if (!telegramId) {
            alert('Введите ваш Telegram ID');
            return;
        }
        
        if (!/^\d+$/.test(telegramId)) {
            alert('Telegram ID должен состоять только из цифр');
            return;
        }
        
        if (!username) {
            alert('Введите ваше имя');
            return;
        }
        
        const sendBtn = document.getElementById('sendTelegramCodeBtn');
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
        
        try {
            const response = await fetch('/api/telegram/send-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telegramId, username })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.tempId = telegramId;
                this.tempUsername = username;
                alert('✅ Код отправлен! Проверьте Telegram');
                this.goToStep2(); 
            } else {
                alert('❌ ' + (data.error || 'Ошибка'));
            }
        } catch (error) {
            alert('❌ Ошибка: ' + error.message);
        } finally {
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="fab fa-telegram"></i> Отправить код';
        }
    }

    async verifyCode() {
        const code = document.getElementById('telegramCodeInput')?.value.trim();
        
        if (!code || code.length !== 6) {
            alert('Введите 6-значный код');
            return;
        }
        
        const verifyBtn = document.getElementById('verifyTelegramCodeBtn');
        verifyBtn.disabled = true;
        verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Проверка...';
        
        try {
            const response = await fetch('/api/auth/telegram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    code, 
                    telegramId: this.tempId,
                    username: this.tempUsername
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
                
                alert('✅ Вход выполнен!');
                this.closeModal();
                window.location.href = '/profile.html';
            } else {
                alert('❌ ' + (data.error || 'Неверный код'));
            }
        } catch (error) {
            alert('❌ Ошибка: ' + error.message);
        } finally {
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = '<i class="fas fa-check"></i> Подтвердить';
        }
    }
}

const telegramAuth = new TelegramAuth();
window.telegramAuth = telegramAuth;