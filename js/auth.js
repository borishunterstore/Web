// Авторизация через Discord с поддержкой PostgreSQL
class DiscordAuth {
    constructor() {
        this.init();
        this.apiBase = '/api'; // Базовый URL для API
    }

    init() {
        console.log('🚀 Auth module initialized with PostgreSQL');
        
        // Проверяем, если мы на странице верификации
        if (window.location.pathname === '/verify.html') {
            this.initVerifyPage();
        }
        
        // НЕ инициализируем кнопку здесь - это делает main.js
        // this.initAuthButton(); - УБИРАЕМ!
        
        // Обработка callback от Discord
        window.addEventListener('message', (event) => {
            if (event.data.type === 'DISCORD_AUTH_CALLBACK') {
                console.log('📨 Received Discord callback');
                this.handleCallback(event.data.code, event.data.state);
            }
        });

        // Автоматически обновляем баланс при загрузке
        this.refreshUserBalance();
    }

    // Обновление баланса пользователя с сервера
    async refreshUserBalance() {
        const authData = this.getAuthData();
        if (authData?.id) {
            try {
                const balance = await DiscordAuth.getUserBalance(authData.id);
                if (balance !== null) {
                    authData.balance = balance;
                    this.saveAuthData(authData);
                    // Вызываем функцию из main.js для обновления интерфейса
                    if (window.checkAuth) {
                        window.checkAuth();
                    }
                }
            } catch (error) {
                console.error('❌ Error refreshing balance:', error);
            }
        }
    }

    // Получение данных пользователя с сервера
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
            
            // Проверяем state
            const savedState = localStorage.getItem('discord_oauth_state');
            if (savedState && savedState !== state) {
                throw new Error('Security: State mismatch');
            }
            localStorage.removeItem('discord_oauth_state');
            
            if (!code) {
                throw new Error('No authorization code received');
            }
            
            // Отправляем код на сервер
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
                
                // Получаем полные данные пользователя с сервера
                const userData = await this.fetchUserData(data.user.id);
                
                // Генерация верификационного кода
                const verificationCode = this.generateVerificationCode();
                console.log('🔐 Generated verification code:', verificationCode);
                
                // Отправка кода пользователю через вебхук
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
                    // Сохранение данных
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
                    
                    // Перенаправление на верификацию
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
            
            // Возвращаемся на страницу авторизации
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
            // Автоматически форматируем код (только цифры)
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
                        // Вызываем checkAuth из main.js для обновления кнопки
                        if (window.checkAuth) {
                            await window.checkAuth();
                        }
                        
                        // Показываем успешное сообщение
                        this.showVerificationSuccess();
                        
                        // Перенаправляем на главную через 2 секунды
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
                // Получаем обновленные данные пользователя
                const userData = await this.fetchUserData(authData.id);
                
                // Обновляем данные пользователя
                const updatedAuth = {
                    ...authData,
                    balance: userData?.balance || 0,
                    badges: userData?.badges || {},
                    verificationCode: undefined, // Удаляем код верификации
                    requiresVerification: false
                };
                
                this.saveAuthData(updatedAuth);
                
                // Отправляем приветственное сообщение
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

    // Вспомогательные функции для работы с данными

    generateVerificationCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Получение данных авторизации из localStorage
    getAuthData() {
        try {
            return JSON.parse(localStorage.getItem('bhstore_auth') || 'null');
        } catch {
            return null;
        }
    }

    // Сохранение данных авторизации
    saveAuthData(data) {
        localStorage.setItem('bhstore_auth', JSON.stringify(data));
    }

    // Статический метод для получения баланса
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

    // Метод для обновления баланса
    static async refreshBalance() {
        const instance = DiscordAuth.instance;
        if (instance) {
            await instance.refreshUserBalance();
        }
    }

    // Метод для обновления баланса после покупки
    static async updateBalanceAfterPurchase(newBalance) {
        const instance = DiscordAuth.instance;
        if (instance) {
            const authData = instance.getAuthData();
            if (authData) {
                authData.balance = newBalance;
                instance.saveAuthData(authData);
                // Вызываем функцию из main.js
                if (window.checkAuth) {
                    window.checkAuth();
                }
            }
        }
    }
}

// Создаем экземпляр и делаем его доступным глобально
const auth = new DiscordAuth();
window.DiscordAuth = DiscordAuth;
DiscordAuth.instance = auth;

// Только обновление баланса, НЕ обновляем кнопку
document.addEventListener('DOMContentLoaded', () => {
    // Просто обновляем баланс в фоне
    auth.refreshUserBalance();
    
    // Также обновляем каждые 30 секунд на случай изменений
    setInterval(async () => {
        await auth.refreshUserBalance();
        // Не вызываем updateAuthButton, только обновляем данные
    }, 30000);
});

// НЕ переопределяем logout - оставляем только в main.js
// window.logout = function() { ... } - УБИРАЕМ!

// Глобальная функция для обновления баланса
window.updateUserBalance = function(newBalance) {
    DiscordAuth.updateBalanceAfterPurchase(newBalance);
};

// Глобальная функция для принудительного обновления данных
window.refreshAuthData = async function() {
    await DiscordAuth.refreshBalance();
};

// Отладочная функция
window.debugAuth = function() {
    const authData = auth.getAuthData();
    console.log('📊 Auth Data:', authData);
    console.log('📊 Badges:', authData?.badges);
    
    // Проверяем API
    fetch('/api/test')
        .then(r => r.json())
        .then(data => console.log('📊 API Test:', data))
        .catch(err => console.error('❌ API Error:', err));
};