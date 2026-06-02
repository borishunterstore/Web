class TelegramAuth {
    constructor() {
      this.botToken = '6876007284:AAH5R2BCqS8RPafZWg5s_0v-DJfoiJsiQco';
      this.botUsername = '@Meentioned_bot';
      this.init();
    }
  
    init() {
      console.log('📱 Telegram Auth загружен');
      this.checkBotStatus();
      this.setupEventListeners();
    }
  
    async checkBotStatus() {
      try {
        const response = await fetch('/api/telegram/status');
        const data = await response.json();
        
        if (data.success) {
          console.log('✅ Telegram бот активен:', data.bot.username);
          document.getElementById('telegramStatus')?.classList.add('active');
        } else {
          console.warn('⚠️ Telegram бот неактивен');
          document.getElementById('telegramStatus')?.classList.add('inactive');
        }
      } catch (error) {
        console.error('Ошибка проверки бота:', error);
      }
    }
  
    setupEventListeners() {
      const sendCodeBtn = document.getElementById('telegramSendCodeBtn');
      const verifyBtn = document.getElementById('telegramVerifyBtn');
      const telegramIdInput = document.getElementById('telegramId');
      const codeInput = document.getElementById('telegramCode');
      
      if (sendCodeBtn) {
        sendCodeBtn.addEventListener('click', () => this.sendCode());
      }
      
      if (verifyBtn) {
        verifyBtn.addEventListener('click', () => this.verifyCode());
      }
      
      if (codeInput) {
        codeInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') this.verifyCode();
        });
      }
    }
  
    async sendCode() {
      const telegramId = document.getElementById('telegramId')?.value.trim();
      const phoneNumber = document.getElementById('telegramPhone')?.value.trim();
      
      if (!telegramId && !phoneNumber) {
        alert('Введите ваш Telegram ID или номер телефона');
        return;
      }
      
      const sendBtn = document.getElementById('telegramSendCodeBtn');
      const originalText = sendBtn.innerHTML;
      sendBtn.disabled = true;
      sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
      
      try {
        const response = await fetch('/api/telegram/send-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telegramId, phoneNumber })
        });
        
        const data = await response.json();
        
        if (data.success) {
          alert('Код отправлен в Telegram! Проверьте сообщения от @Meentioned_bot');
          document.getElementById('telegramCodeGroup')?.classList.add('show');
          document.getElementById('telegramCode')?.focus();
        } else {
          alert('Ошибка: ' + (data.error || 'Не удалось отправить код'));
        }
      } catch (error) {
        alert('Ошибка: ' + error.message);
      } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = originalText;
      }
    }
  
    async verifyCode() {
      const code = document.getElementById('telegramCode')?.value.trim();
      const telegramId = document.getElementById('telegramId')?.value.trim();
      const phoneNumber = document.getElementById('telegramPhone')?.value.trim();
      const username = document.getElementById('telegramUsername')?.value.trim();
      const firstName = document.getElementById('telegramFirstName')?.value.trim();
      const lastName = document.getElementById('telegramLastName')?.value.trim();
      
      if (!code || code.length !== 6) {
        alert('Введите 6-значный код');
        return;
      }
      
      const verifyBtn = document.getElementById('telegramVerifyBtn');
      const originalText = verifyBtn.innerHTML;
      verifyBtn.disabled = true;
      verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Проверка...';
      
      try {
        const response = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            code, 
            telegramId, 
            phoneNumber,
            username,
            firstName,
            lastName
          })
        });
        
        const data = await response.json();
        
        if (data.success && data.user) {
          // Сохраняем данные авторизации
          const authData = {
            id: data.user.id,
            username: data.user.username,
            email: data.user.email,
            avatar: null,
            token: data.token,
            authMethod: 'telegram',
            balance: 0,
            badges: {}
          };
          
          localStorage.setItem('bhstore_auth', JSON.stringify(authData));
          
          if (window.api) {
            window.api.setAuthToken(data.token);
          }
          
          alert('✅ Авторизация успешна!');
          window.location.href = '/profile.html';
        } else {
          alert('Ошибка: ' + (data.error || 'Неверный код'));
        }
      } catch (error) {
        alert('Ошибка: ' + error.message);
      } finally {
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = originalText;
      }
    }
  
    showModal() {
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.id = 'telegramAuthModal';
      modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); display: flex; justify-content: center; align-items: center; z-index: 10001; backdrop-filter: blur(8px);';
      
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 450px; width: 90%; background: #2a2b36; border-radius: 20px; padding: 0; overflow: hidden;">
          <div style="padding: 20px; background: #1e1f29; border-bottom: 1px solid #40444b; display: flex; justify-content: space-between; align-items: center;">
            <h2 style="margin: 0; color: white;"><i class="fab fa-telegram"></i> Авторизация через Telegram</h2>
            <button onclick="this.closest('.modal').remove()" style="background: none; border: none; color: #b9bbbe; font-size: 1.5rem; cursor: pointer;">×</button>
          </div>
          
          <div style="padding: 20px;">
            <div id="telegramStatus" style="margin-bottom: 15px; padding: 10px; border-radius: 8px; background: #1e1f29; text-align: center;">
              <i class="fas fa-spinner fa-spin"></i> Проверка статуса бота...
            </div>
            
            <div class="form-group" style="margin-bottom: 15px;">
              <label style="color: #b9bbbe;">Ваш Telegram ID</label>
              <input type="text" id="telegramId" placeholder="Например: 123456789" style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
              <small style="color: #72767d;">Можно узнать у бота @userinfobot</small>
            </div>
            
            <div class="form-group" style="margin-bottom: 15px;">
              <label style="color: #b9bbbe;">ИЛИ номер телефона</label>
              <input type="tel" id="telegramPhone" placeholder="+7XXXXXXXXXX" style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
            </div>
            
            <div class="form-group" style="margin-bottom: 15px;">
              <label style="color: #b9bbbe;">Ваше имя (для отображения)</label>
              <input type="text" id="telegramUsername" placeholder="Ваше имя" style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
            </div>
            
            <button id="telegramSendCodeBtn" class="btn-telegram" style="width: 100%; background: #26A5E4; border: none; padding: 14px; border-radius: 8px; color: white; font-weight: 600; cursor: pointer; margin-bottom: 20px;">
              <i class="fab fa-telegram"></i> Отправить код в Telegram
            </button>
            
            <div id="telegramCodeGroup" style="display: none;">
              <div class="form-group" style="margin-bottom: 15px;">
                <label style="color: #b9bbbe;">Код подтверждения</label>
                <input type="text" id="telegramCode" placeholder="Введите 6-значный код" maxlength="6" style="width: 100%; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white; text-align: center; font-size: 1.2rem; letter-spacing: 5px;">
              </div>
              
              <button id="telegramVerifyBtn" class="btn-telegram" style="width: 100%; background: #57F287; border: none; padding: 14px; border-radius: 8px; color: #1e1f29; font-weight: 600; cursor: pointer;">
                <i class="fas fa-check"></i> Подтвердить и войти
              </button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      this.setupEventListeners();
      this.checkBotStatus();
    }
  }
  
  // Инициализация
  const telegramAuth = new TelegramAuth();
  window.telegramAuth = telegramAuth;