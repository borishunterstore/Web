// auth.js - Оптимизированная авторизация
class DiscordAuth {
    constructor() {
        this.apiBase = '/api';
        this.authEnabled = true;
        this.registrationEnabled = true;
        this.cache = new Map();
        this.init();
    }

    init() {
        console.log('✅ AUTH загружен');
        this.checkAuthStatus();
        this.checkUrlForToken();
        
        if (window.location.pathname === '/verify.html') {
            this.initVerifyPage();
        }
        
        window.addEventListener('message', (e) => {
            if (e.data?.type === 'DISCORD_AUTH_CALLBACK') {
                this.handleCallback(e.data.code, e.data.state);
            }
        });
        
        this.refreshUserBalance();
        this.updateAuthButton();
    }

    updateAuthButton() {
        const authData = this.getAuthData();
        const authBtn = document.getElementById('authBtn');
        
        if (!authBtn) return;
        
        if (authData?.id) {
            let avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';
            if (authData.avatar) {
                const ext = authData.avatar.startsWith('a_') ? 'gif' : 'png';
                avatarUrl = `https://cdn.discordapp.com/avatars/${authData.id}/${authData.avatar}.${ext}?size=32`;
            }
            
            authBtn.innerHTML = `
                <img src="${avatarUrl}" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 8px;" 
                     onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                ${authData.username || 'Профиль'}
            `;
            authBtn.onclick = () => window.location.href = '/profile.html';
            authBtn.classList.add('auth-authenticated');
        } else {
            authBtn.innerHTML = '<i class="fab fa-discord"></i> Войти';
            authBtn.onclick = () => window.location.href = '/auth.html';
            authBtn.classList.remove('auth-authenticated');
        }
    }
    
    async checkAuthStatus() {
        try {
            const cached = this.cache.get('authStatus');
            if (cached && Date.now() - cached.time < 60000) {
                this.authEnabled = cached.value;
                return this.authEnabled;
            }
            
            const response = await fetch('/api/auth-status');
            const data = await response.json();
            this.authEnabled = data.success ? data.auth_enabled !== false : true;
            this.cache.set('authStatus', { value: this.authEnabled, time: Date.now() });
            localStorage.setItem('bhstore_auth_enabled', this.authEnabled);
            return this.authEnabled;
        } catch {
            return true;
        }
    }

    async checkRegistrationStatus() {
        try {
            const cached = this.cache.get('regStatus');
            if (cached && Date.now() - cached.time < 60000) {
                this.registrationEnabled = cached.value;
                return this.registrationEnabled;
            }
            
            const response = await fetch('/api/shop-settings');
            const data = await response.json();
            this.registrationEnabled = data.success ? data.settings.registration_enabled !== false : true;
            this.cache.set('regStatus', { value: this.registrationEnabled, time: Date.now() });
            localStorage.setItem('bhstore_registration_enabled', this.registrationEnabled);
            return this.registrationEnabled;
        } catch {
            return true;
        }
    }

    checkUrlForToken() {
        const token = new URLSearchParams(window.location.search).get('token');
        if (!token) return;
        
        try {
            const userData = JSON.parse(atob(token));
            const authData = {
                id: userData.id,
                username: userData.username,
                email: userData.email,
                avatar: userData.avatar,
                token: token,
                requiresVerification: false
            };
            this.saveAuthData(authData);
            window.api?.setAuthToken(token);
            window.history.replaceState({}, '', window.location.pathname);
            window.location.href = '/';
        } catch (error) {
            console.error('❌ Ошибка токена:', error);
        }
    }

    async refreshUserBalance() {
        const authData = this.getAuthData();
        if (!authData?.id) return;
        
        try {
            const response = await fetch(`${this.apiBase}/user/${authData.id}/balance`);
            if (response.ok) {
                const data = await response.json();
                if (data.balance !== undefined) {
                    authData.balance = data.balance;
                    this.saveAuthData(authData);
                    window.updateBalanceDisplay?.(data.balance);
                    window.checkAuth?.();
                }
            }
        } catch (error) {
            console.error('❌ Ошибка баланса:', error);
        }
    }

    async fetchUserData(userId) {
        try {
            const response = await fetch(`${this.apiBase}/user/${userId}`);
            if (response.ok) {
                const data = await response.json();
                return data.user;
            }
        } catch (error) {
            console.error('❌ Ошибка данных пользователя:', error);
        }
        return null;
    }

    async handleCallback(code, state) {
        try {
            if (!(await this.checkAuthStatus())) {
                alert('Авторизация временно недоступна');
                window.location.href = '/';
                return;
            }
            
            const savedState = localStorage.getItem('discord_oauth_state');
            if (savedState !== state) throw new Error('State mismatch');
            localStorage.removeItem('discord_oauth_state');
            if (!code) throw new Error('No code');
            
            const response = await fetch(`${this.apiBase}/auth/discord`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Auth failed');
            if (!data.success) throw new Error(data.error || 'Auth failed');
            
            const userData = await this.fetchUserData(data.user.id);
            const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
            
            const sendResponse = await fetch(`${this.apiBase}/send-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: data.user.id, code: verificationCode })
            });
            
            const sendResult = await sendResponse.json();
            if (!sendResult.success) throw new Error('Failed to send code');
            
            const authData = {
                id: data.user.id,
                username: data.user.username,
                email: data.user.email,
                avatar: data.user.avatar,
                balance: userData?.balance || 0,
                badges: userData?.badges || {},
                verificationCode,
                token: data.token,
                requiresVerification: true
            };
            
            this.saveAuthData(authData);
            window.api?.setAuthToken(data.token);
            window.location.href = '/verify.html';
            
        } catch (error) {
            console.error('❌ Ошибка:', error);
            alert('Ошибка авторизации: ' + error.message);
            setTimeout(() => window.location.href = '/auth.html', 2000);
        }
    }

    initVerifyPage() {
        const verifyBtn = document.getElementById('verifyBtn');
        const codeInput = document.getElementById('verificationCode');
        const resendBtn = document.getElementById('resendBtn');
        
        if (!verifyBtn || !codeInput) return;
        
        codeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
        });
        
        verifyBtn.addEventListener('click', async () => {
            const code = codeInput.value.trim();
            if (!code || code.length !== 6) {
                alert('Введите 6-значный код');
                return;
            }
            
            verifyBtn.disabled = true;
            verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Проверка...';
            
            try {
                if (await this.verifyCode(code)) {
                    this.showVerificationSuccess();
                    setTimeout(() => window.location.href = '/', 2000);
                } else {
                    throw new Error('Неверный код');
                }
            } catch (error) {
                alert('Ошибка: ' + error.message);
                verifyBtn.disabled = false;
                verifyBtn.innerHTML = '<i class="fas fa-check"></i> Подтвердить';
            }
        });
        
        if (resendBtn) {
            resendBtn.addEventListener('click', async () => {
                const authData = this.getAuthData();
                if (!authData?.id) {
                    alert('Сессия истекла');
                    window.location.href = '/auth.html';
                    return;
                }
                
                resendBtn.disabled = true;
                const originalText = resendBtn.innerHTML;
                resendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
                
                try {
                    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
                    const response = await fetch(`${this.apiBase}/send-verification`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: authData.id, code: newCode })
                    });
                    const result = await response.json();
                    
                    if (result.success) {
                        authData.verificationCode = newCode;
                        this.saveAuthData(authData);
                        alert('Новый код отправлен!');
                    } else {
                        throw new Error('Failed to resend');
                    }
                } catch (error) {
                    alert('Ошибка отправки');
                } finally {
                    resendBtn.disabled = false;
                    resendBtn.innerHTML = originalText;
                }
            });
        }
    }

    async verifyCode(inputCode) {
        if (!(await this.checkRegistrationStatus())) {
            throw new Error('Регистрация временно недоступна');
        }
        
        const authData = this.getAuthData();
        if (!authData?.id) throw new Error('Сессия истекла');
        if (authData.verificationCode !== inputCode) throw new Error('Неверный код');
        
        const response = await fetch(`${this.apiBase}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                discordId: authData.id,
                username: authData.username,
                email: authData.email,
                avatar: authData.avatar
            })
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'Registration failed');
        
        const userData = await this.fetchUserData(authData.id);
        const updatedAuth = {
            ...authData,
            balance: userData?.balance || 0,
            badges: userData?.badges || {},
            verificationCode: undefined,
            requiresVerification: false
        };
        
        this.saveAuthData(updatedAuth);
        
        fetch(`${this.apiBase}/welcome-message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: authData.id })
        }).catch(console.error);
        
        return true;
    }

    showVerificationSuccess() {
        const container = document.querySelector('.verify-container');
        if (container) {
            container.innerHTML = `
                <div style="text-align:center;padding:3rem">
                    <div style="width:100px;height:100px;background:#57F287;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 2rem">
                        <i class="fas fa-check" style="color:white;font-size:3rem"></i>
                    </div>
                    <h2 style="color:#57F287">Аккаунт верифицирован!</h2>
                    <p style="color:#b9bbbe">Перенаправление...</p>
                </div>
            `;
        }
    }

    getAuthData() {
        try {
            return JSON.parse(localStorage.getItem('bhstore_auth') || 'null');
        } catch {
            return null;
        }
    }

    saveAuthData(data) {
        localStorage.setItem('bhstore_auth', JSON.stringify(data));
    }

    isAuthenticated() {
        const data = this.getAuthData();
        return !!(data?.id && data?.token);
    }

    getToken() {
        return this.getAuthData()?.token || null;
    }

    logout() {
        localStorage.removeItem('bhstore_auth');
        window.api?.setAuthToken(null);
        window.location.href = '/';
    }

    static async getUserBalance(userId) {
        try {
            const response = await fetch(`/api/user/${userId}/balance`);
            if (response.ok) {
                const data = await response.json();
                return data.balance || 0;
            }
        } catch (error) {
            console.error('❌ Ошибка баланса:', error);
        }
        return null;
    }
}

async function startTelegramAuth() {
    if (!checkAllConsents()) {
        warningMessage.classList.add('show');
        return;
    }
    
    if (isTelegramProcessing) return;
    isTelegramProcessing = true;
    
    const btn = telegramBtn;
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="btn-auth-icon"><i class="fas fa-spinner fa-spin"></i></div><div class="btn-auth-content"><span class="btn-auth-title">Обработка...</span><span class="btn-auth-desc">Пожалуйста, подождите</span></div><i class="fas fa-chevron-right btn-auth-arrow"></i>';
    
    try {
        // Ждём загрузки grecaptcha (максимум 5 секунд)
        let waitCount = 0;
        while (typeof grecaptcha === 'undefined' && waitCount < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            waitCount++;
        }
        
        if (typeof grecaptcha === 'undefined') {
            throw new Error('reCAPTCHA не загрузилась. Пожалуйста, обновите страницу.');
        }
        
        // Получаем reCAPTCHA токен
        const recaptchaToken = await grecaptcha.execute('6LfunBMtAAAAAERlHV1wjXssrw5yYmgPUmxvVUAQ', { action: 'telegram_login' });
        
        if (!recaptchaToken) {
            throw new Error('Не удалось получить подтверждение reCAPTCHA');
        }
        
        // Создаём сессию на сервере
        const response = await fetch('/api/telegram/create-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recaptchaToken })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Открываем ссылку на бота
            window.open(data.botLink, '_blank');
            alert('✅ Перейдите в Telegram и подтвердите вход!\n\nСсылка действительна 10 минут.');
        } else {
            alert('❌ Ошибка: ' + (data.error || 'Не удалось создать сессию'));
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    } catch (error) {
        console.error('Telegram auth error:', error);
        alert('❌ Ошибка: ' + error.message);
        btn.disabled = false;
        btn.innerHTML = originalContent;
    } finally {
        isTelegramProcessing = false;
    }
}

const auth = new DiscordAuth();
window.DiscordAuth = DiscordAuth;
window.auth = auth;

document.addEventListener('DOMContentLoaded', () => {
    auth.refreshUserBalance();
    setInterval(() => auth.refreshUserBalance(), 30000);
});

window.updateUserBalance = (balance) => {
    const authData = auth.getAuthData();
    if (authData) {
        authData.balance = balance;
        auth.saveAuthData(authData);
        window.updateBalanceDisplay?.(balance);
        window.checkAuth?.();
    }
};

window.logout = () => auth.logout();
window.getAuthToken = () => auth.getToken();
window.isAuthenticated = () => auth.isAuthenticated();