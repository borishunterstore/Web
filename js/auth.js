// auth.js - Полная версия с интеграцией API и балансом
class DiscordAuth {
    constructor() {
        this.apiBase = '/api';
        this.init();
    }

    init() {
        console.log('🚀 Auth module initialized with PostgreSQL');
        
        // Проверяем наличие токена в URL при загрузке
        this.checkUrlForToken();
        
        if (window.location.pathname === '/verify.html') {
            this.initVerifyPage();
        }
        
        window.addEventListener('message', (event) => {
            if (event.data.type === 'DISCORD_AUTH_CALLBACK') {
                console.log('📨 Received Discord callback');
                this.handleCallback(event.data.code, event.data.state);
            }
        });

        // Обновляем баланс при загрузке
        this.refreshUserBalance();
        
        // Обновляем кнопку авторизации
        this.updateAuthButton();
    }

    checkUrlForToken() {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        
        if (token) {
            try {
                // Декодируем токен для получения данных пользователя
                const userData = JSON.parse(atob(token));
                
                const authData = {
                    id: userData.id,
                    username: userData.username,
                    global_name: userData.global_name || userData.username,
                    email: userData.email,
                    avatar: userData.avatar,
                    balance: userData.balance || 0,
                    badges: userData.badges || {},
                    token: token,
                    requiresVerification: false
                };
                
                this.saveAuthData(authData);
                
                // Обновляем токен в API
                if (window.api) {
                    window.api.setAuthToken(token);
                }
                
                // Очищаем URL от токена
                window.history.replaceState({}, document.title, window.location.pathname);
                
                console.log('✅ Авторизация через токен в URL');
                
                // Перенаправляем на главную
                window.location.href = '/';
            } catch (error) {
                console.error('❌ Ошибка декодирования токена:', error);
            }
        }
    }

    async refreshUserBalance() {
        const authData = this.getAuthData();
        if (authData?.id) {
            try {
                const balance = await DiscordAuth.getUserBalance(authData.id);
                if (balance !== null) {
                    authData.balance = balance;
                    this.saveAuthData(authData);
                    
                    // Обновляем UI
                    if (window.updateBalanceDisplay) {
                        window.updateBalanceDisplay(balance);
                    }
                    
                    if (window.checkAuth) {
                        window.checkAuth();
                    }
                }
            } catch (error) {
                console.error('❌ Error refreshing balance:', error);
            }
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
            console.error('❌ Error fetching user data:', error);
        }
        return null;
    }

    async handleCallback(code, state) {
        try {
            console.log('🔄 Processing Discord callback...');
            
            const savedState = localStorage.getItem('discord_oauth_state');
            if (savedState && savedState !== state) {
                throw new Error('Security: State mismatch');
            }
            localStorage.removeItem('discord_oauth_state');
            
            if (!code) {
                throw new Error('No authorization code received');
            }
            
            const response = await fetch(`${this.apiBase}/auth/discord`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Server error: ${response.status}`);
            }

            if (data.success && data.user) {
                console.log('✅ User authenticated:', data.user.username);
                
                const userData = await this.fetchUserData(data.user.id);
                const verificationCode = this.generateVerificationCode();
                console.log('🔐 Generated verification code:', verificationCode);
                
                const sendCodeResponse = await fetch(`${this.apiBase}/send-verification`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userId: data.user.id,
                        code: verificationCode
                    })
                });
                
                const sendCodeResult = await sendCodeResponse.json();
                
                if (sendCodeResult.success) {
                    const authData = {
                        id: data.user.id,
                        username: data.user.username,
                        global_name: data.user.global_name || data.user.username,
                        email: data.user.email,
                        avatar: data.user.avatar,
                        balance: userData?.balance || 0,
                        badges: userData?.badges || {},
                        verificationCode: verificationCode,
                        token: data.token,
                        requiresVerification: true
                    };
                    
                    this.saveAuthData(authData);
                    
                    // Обновляем токен в API
                    if (window.api) {
                        window.api.setAuthToken(data.token);
                    }
                    
                    window.location.href = '/verify.html';
                } else {
                    throw new Error(sendCodeResult.error || 'Failed to send verification code');
                }
            } else {
                throw new Error(data.error || 'Authentication failed');
            }
        } catch (error) {
            console.error('❌ Auth error:', error);
            alert('Ошибка авторизации: ' + error.message);
            
            setTimeout(() => {
                window.location.href = '/auth.html';
            }, 2000);
        }
    }

    initVerifyPage() {
        const verifyBtn = document.getElementById('verifyBtn');
        const codeInput = document.getElementById('verificationCode');
        const resendBtn = document.getElementById('resendBtn');
        
        if (verifyBtn && codeInput) {
            codeInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
            });
            
            verifyBtn.addEventListener('click', async () => {
                const code = codeInput.value.trim();
                
                if (!code || code.length !== 6) {
                    alert('Введите 6-значный код верификации');
                    return;
                }
                
                verifyBtn.disabled = true;
                verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Проверка...';
                
                try {
                    const success = await this.verifyCode(code);
                    
                    if (success) {
                        if (window.checkAuth) {
                            await window.checkAuth();
                        }
                        
                        this.showVerificationSuccess();
                        setTimeout(() => {
                            window.location.href = '/';
                        }, 2000);
                    } else {
                        throw new Error('Неверный код');
                    }
                } catch (error) {
                    alert('Ошибка верификации: ' + error.message);
                    verifyBtn.disabled = false;
                    verifyBtn.innerHTML = '<i class="fas fa-check"></i> Подтвердить код';
                }
            });
        }
        
        if (resendBtn) {
            resendBtn.addEventListener('click', async () => {
                const authData = this.getAuthData();
                if (!authData?.id) {
                    alert('Сессия истекла. Пожалуйста, авторизуйтесь снова.');
                    window.location.href = '/auth.html';
                    return;
                }
                
                resendBtn.disabled = true;
                const originalText = resendBtn.innerHTML;
                resendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
                
                try {
                    const newCode = this.generateVerificationCode();
                    
                    const response = await fetch(`${this.apiBase}/send-verification`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            userId: authData.id,
                            code: newCode
                        })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        authData.verificationCode = newCode;
                        this.saveAuthData(authData);
                        alert('Новый код отправлен! Проверьте Discord');
                    } else {
                        throw new Error(result.error || 'Failed to resend code');
                    }
                } catch (error) {
                    alert('Ошибка при отправке кода: ' + error.message);
                } finally {
                    resendBtn.disabled = false;
                    resendBtn.innerHTML = originalText;
                }
            });
        }
    }

    async verifyCode(inputCode) {
        try {
            const authData = this.getAuthData();
            
            if (!authData?.id) {
                throw new Error('Сессия истекла. Пожалуйста, авторизуйтесь снова.');
            }

            if (authData.verificationCode !== inputCode) {
                throw new Error('Неверный код верификации');
            }

            // Регистрация пользователя
            const response = await fetch(`${this.apiBase}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    discordId: authData.id,
                    username: authData.username,
                    email: authData.email,
                    avatar: authData.avatar
                })
            });

            const result = await response.json();

            if (result.success) {
                const userData = await this.fetchUserData(authData.id);
                
                const updatedAuth = {
                    ...authData,
                    balance: userData?.balance || 0,
                    badges: userData?.badges || {},
                    verificationCode: undefined,
                    requiresVerification: false
                };
                
                this.saveAuthData(updatedAuth);
                
                try {
                    await fetch(`${this.apiBase}/welcome-message`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ userId: authData.id })
                    });
                } catch (error) {
                    console.error('❌ Welcome message error:', error);
                }
                
                return true;
            } else {
                throw new Error(result.error || 'Registration failed');
            }
        } catch (error) {
            console.error('❌ Verification error:', error);
            throw error;
        }
    }

    showVerificationSuccess() {
        const verifyContainer = document.querySelector('.verify-container');
        if (verifyContainer) {
            verifyContainer.innerHTML = `
                <div style="text-align: center; padding: 3rem;">
                    <div style="width: 100px; height: 100px; background: #57F287; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 2rem;">
                        <i class="fas fa-check" style="color: white; font-size: 3rem;"></i>
                    </div>
                    <h2 style="color: #57F287; margin-bottom: 1rem;">Аккаунт верифицирован!</h2>
                    <p style="color: #b9bbbe; margin-bottom: 2rem;">
                        <i class="fas fa-check-circle" style="color: #57F287;"></i>
                        Ваш аккаунт успешно подтвержден. Теперь вы можете совершать покупки.
                    </p>
                    <div class="loader" style="margin: 0 auto;"></div>
                    <p style="color: #b9bbbe; margin-top: 1rem;">Перенаправление...</p>
                </div>
            `;
        }
    }

    generateVerificationCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
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

    // ===== ВАША ФУНКЦИЯ setAuthData =====
    setAuthData(userData, token) {
        const authData = {
            id: userData.id,
            username: userData.username,
            avatar: userData.avatar,
            email: userData.email,
            token: token,
            balance: userData.balance || 0,
            badges: userData.badges || {}
        };
        
        localStorage.setItem('bhstore_auth', JSON.stringify(authData));
        
        // Обновляем токен в API
        if (window.api) {
            window.api.setAuthToken(token);
        }
        
        // Обновляем UI
        this.updateAuthButton();
        
        return authData;
    }

    // Обновление кнопки авторизации
    updateAuthButton() {
        const authData = this.getAuthData();
        const authBtn = document.getElementById('authBtn');
        
        if (!authBtn) return;
        
        if (authData?.id) {
            // Пользователь авторизован
            authBtn.innerHTML = `
                <img src="https://cdn.discordapp.com/avatars/${authData.id}/${authData.avatar}.png?size=32" 
                     style="width: 24px; height: 24px; border-radius: 50%; margin-right: 8px;"
                     onerror="this.style.display='none'">
                ${authData.username || 'Профиль'}
            `;
            authBtn.onclick = () => window.location.href = '/profile.html';
        } else {
            // Пользователь не авторизован
            authBtn.innerHTML = '<i class="fab fa-discord"></i> Войти';
            authBtn.onclick = () => window.location.href = '/auth.html';
        }
    }

    // Проверка авторизации
    isAuthenticated() {
        const authData = this.getAuthData();
        return !!(authData?.id && authData?.token);
    }

    // Получение токена
    getToken() {
        const authData = this.getAuthData();
        return authData?.token || null;
    }

    // Выход из аккаунта
    logout() {
        localStorage.removeItem('bhstore_auth');
        
        // Очищаем токен в API
        if (window.api) {
            window.api.setAuthToken(null);
        }
        
        this.updateAuthButton();
        
        // Перенаправляем на главную
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
            console.error('❌ Error getting user balance:', error);
        }
        return null;
    }

    static async refreshBalance() {
        const instance = DiscordAuth.instance;
        if (instance) {
            await instance.refreshUserBalance();
        }
    }

    static async updateBalanceAfterPurchase(newBalance) {
        const instance = DiscordAuth.instance;
        if (instance) {
            const authData = instance.getAuthData();
            if (authData) {
                authData.balance = newBalance;
                instance.saveAuthData(authData);
                
                // Обновляем UI
                if (window.updateBalanceDisplay) {
                    window.updateBalanceDisplay(newBalance);
                }
                
                if (window.checkAuth) {
                    window.checkAuth();
                }
            }
        }
    }
}

// Создаем и экспортируем экземпляр
const auth = new DiscordAuth();
window.DiscordAuth = DiscordAuth;
window.auth = auth;
DiscordAuth.instance = auth;

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    // Обновляем баланс
    auth.refreshUserBalance();
    
    // Обновляем кнопку авторизации
    auth.updateAuthButton();
    
    // Периодическое обновление баланса (каждые 30 секунд)
    setInterval(async () => {
        await auth.refreshUserBalance();
    }, 30000);
});

// Глобальные функции для использования в других скриптах
window.updateUserBalance = function(newBalance) {
    DiscordAuth.updateBalanceAfterPurchase(newBalance);
};

window.refreshAuthData = async function() {
    await DiscordAuth.refreshBalance();
};

window.logout = function() {
    if (window.auth) {
        window.auth.logout();
    } else {
        localStorage.removeItem('bhstore_auth');
        window.location.href = '/';
    }
};

window.getAuthToken = function() {
    if (window.auth) {
        return window.auth.getToken();
    }
    return null;
};

window.isAuthenticated = function() {
    if (window.auth) {
        return window.auth.isAuthenticated();
    }
    return false;
};

// Дебаг функция
window.debugAuth = function() {
    const authData = auth.getAuthData();
    console.log('📊 Auth Data:', authData);
    console.log('📊 Badges:', authData?.badges);
    console.log('📊 Is Authenticated:', auth.isAuthenticated());
    console.log('📊 Token:', auth.getToken()?.substring(0, 20) + '...');
    
    fetch('/api/test')
        .then(r => r.json())
        .then(data => console.log('📊 API Test:', data))
        .catch(err => console.error('❌ API Error:', err));
};