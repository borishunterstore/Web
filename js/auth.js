// Авторизация через Discord
class DiscordAuth {
    constructor() {
        this.init();
    }

    init() {
        console.log('Auth module initialized');
        
        // Проверяем, если мы на странице верификации
        if (window.location.pathname === '/verify.html') {
            this.initVerifyPage();
        }
        
        // Инициализируем кнопку авторизации на всех страницах
        this.initAuthButton();
        
        // Обработка callback от Discord
        window.addEventListener('message', (event) => {
            if (event.data.type === 'DISCORD_AUTH_CALLBACK') {
                console.log('Received Discord callback');
                this.handleCallback(event.data.code, event.data.state);
            }
        });
    }

    initAuthButton() {
        const authBtn = document.getElementById('authBtn');
        if (authBtn) {
            // Проверяем текущий статус авторизации
            this.updateAuthButton();
            
            // Если кнопка еще не имеет обработчика, добавляем его
            if (!authBtn.hasAttribute('data-auth-initialized')) {
                authBtn.addEventListener('click', () => {
                    const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
                    
                    if (authData.username && !authData.verificationCode) {
                        // Пользователь уже авторизован - показываем меню
                        this.showUserMenu();
                    } else {
                        // Перенаправляем на страницу авторизации
                        window.location.href = '/auth.html';
                    }
                });
                
                authBtn.setAttribute('data-auth-initialized', 'true');
            }
        }
    }

    updateAuthButton() {
        const authBtn = document.getElementById('authBtn');
        if (!authBtn) return;
        
        const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        
        if (authData.username && !authData.verificationCode) {
            // Получаем бейджи пользователя
            const badges = this.getUserBadges(authData);
            
            // Пользователь авторизован и верифицирован
            authBtn.innerHTML = `
                <img src="https://cdn.discordapp.com/avatars/${authData.id}/${authData.avatar}.png?size=32" 
                     style="width: 32px; height: 32px; border-radius: 50%; margin-right: 8px;"
                     onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                <span style="vertical-align: middle;">${authData.username}</span>
                ${badges}
                <i class="fas fa-chevron-down" style="margin-left: 8px; vertical-align: middle;"></i>
            `;
        } else if (authData.username && authData.verificationCode) {
            // Пользователь авторизован, но не верифицирован
            authBtn.innerHTML = `
                <i class="fas fa-hourglass-half"></i>
                <span>Завершить регистрацию</span>
            `;
            authBtn.onclick = () => {
                window.location.href = '/verify.html';
            };
        } else {
            // Не авторизован
            authBtn.innerHTML = '<i class="fab fa-discord"></i> Войти через Discord';
            authBtn.onclick = () => {
                window.location.href = '/auth.html';
            };
        }
    }

    // Получение бейджей пользователя (для кнопки)
    getUserBadges(authData) {
        let badges = '';
        
        // Проверяем и нормализуем badges
        const userBadges = this.normalizeBadges(authData.badges);
        
        // Бейджи для отображения в кнопке (только verified показываем рядом с именем)
        if (userBadges.verified) {
            badges += `
                <img src="https://cdn3.emoji.gg/emojis/32765-verifiedtwitter.gif" 
                     style="width: 18px; height: 18px; margin-left: 6px; vertical-align: middle; border-radius: 50%;" 
                     title="✓ Верифицированный аккаунт">
            `;
        }
        
        return badges;
    }

    // Нормализация бейджей (всегда возвращаем объект)
    normalizeBadges(badgesData) {
        // Если badges нет или undefined
        if (!badgesData) {
            return {
                verified: false,
                partner: false,
                buyer: false
            };
        }
        
        // Если badges строка
        if (typeof badgesData === 'string') {
            if (badgesData === 'verified') {
                return { verified: true, partner: false, buyer: false };
            }
            return { verified: false, partner: false, buyer: false };
        }
        
        // Если badges объект
        if (typeof badgesData === 'object') {
            return {
                verified: !!badgesData.verified,
                partner: !!badgesData.partner,
                buyer: !!badgesData.buyer
            };
        }
        
        // По умолчанию
        return {
            verified: false,
            partner: false,
            buyer: false
        };
    }

    async handleCallback(code, state) {
        try {
            console.log('Processing Discord callback...');
            
            const response = await fetch('/api/auth/discord', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code })
            });

            const data = await response.json();

            if (data.success && data.user) {
                console.log('User authenticated:', data.user.username);
                
                // Получаем данные пользователя с сервера
                try {
                    const userResponse = await fetch(`/api/user/${data.user.id}`);
                    if (userResponse.ok) {
                        const userData = await userResponse.json();
                        if (userData.success && userData.user) {
                            data.user = { ...data.user, ...userData.user };
                        }
                    }
                } catch (error) {
                    console.error('Error fetching user data:', error);
                }
                
                // Генерация верификационного кода
                const verificationCode = this.generateVerificationCode();
                console.log('Generated verification code:', verificationCode);
                
                // Отправка кода пользователю
                const sendCodeResponse = await fetch('/api/send-verification', {
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
                        ...data.user,
                        verificationCode: verificationCode,
                        token: data.token
                    };
                    
                    // Нормализуем бейджи перед сохранением
                    if (authData.badges) {
                        authData.badges = this.normalizeBadges(authData.badges);
                    }
                    
                    localStorage.setItem('bhstore_auth', JSON.stringify(authData));
                    
                    // Обновляем кнопку авторизации
                    this.updateAuthButton();
                    
                    // Перенаправление на верификацию
                    window.location.href = '/verify.html';
                } else {
                    throw new Error(sendCodeResult.error || 'Failed to send verification code');
                }
            } else {
                throw new Error(data.error || 'Authentication failed');
            }
        } catch (error) {
            console.error('Auth error:', error);
            alert('Ошибка авторизации: ' + error.message);
        }

        if (data.success && data.user) {
            const userData = data.user;
            
            const testOrder = {
                id: 'TEST-' + Date.now(),
                userId: userData.id,
                product: 'Тестовый товар',
                productName: 'Тестовый товар',
                amount: 100,
                status: 'completed',
                date: new Date().toISOString()
            };
            
            const orders = JSON.parse(localStorage.getItem('bhstore_orders') || '[]');
            orders.push(testOrder);
            localStorage.setItem('bhstore_orders', JSON.stringify(orders));
        }
    }

    initVerifyPage() {
        const verifyBtn = document.getElementById('verifyBtn');
        const codeInput = document.getElementById('verificationCode');
        
        if (verifyBtn && codeInput) {
            verifyBtn.addEventListener('click', async () => {
                const code = codeInput.value.trim();
                
                if (!code) {
                    alert('Введите код верификации');
                    return;
                }
                
                verifyBtn.disabled = true;
                verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Проверка...';
                
                try {
                    const success = await this.verifyCode(code);
                    
                    if (success) {
                        // Обновляем кнопку авторизации
                        this.updateAuthButton();
                        
                        // Перенаправляем на главную
                        window.location.href = '/';
                    }
                } catch (error) {
                    alert('Ошибка верификации: ' + error.message);
                    verifyBtn.disabled = false;
                    verifyBtn.innerHTML = '<i class="fas fa-check"></i> Подтвердить код';
                }
            });
        }
    }

    async verifyCode(inputCode) {
        try {
            const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
            
            if (!authData.id) {
                throw new Error('Сессия истекла. Пожалуйста, авторизуйтесь снова.');
            }

            if (authData.verificationCode !== inputCode) {
                throw new Error('Неверный код верификации');
            }

            // Регистрация пользователя
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    discordId: authData.id,
                    username: authData.username,
                    email: authData.email,
                    avatar: authData.avatar,
                    balance: authData.balance || 0
                })
            });

            const result = await response.json();

            if (result.success) {
                // Обновляем данные пользователя с сервера
                const updatedUser = { 
                    ...authData, 
                    ...result.user,
                    verificationCode: undefined // Удаляем код верификации
                };
                
                // Нормализуем бейджи
                if (result.user.badges) {
                    updatedUser.badges = this.normalizeBadges(result.user.badges);
                }
                
                // Сохраняем обновленные данные
                localStorage.setItem('bhstore_auth', JSON.stringify(updatedUser));
                
                // Отправка приветственного сообщения
                try {
                    await fetch('/api/welcome-message', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ userId: authData.id })
                    });
                } catch (error) {
                    console.error('Welcome message error:', error);
                }
                
                // Показываем успешное сообщение
                this.showVerificationSuccess();
                
                return true;
            } else {
                throw new Error(result.error || 'Registration failed');
            }
        } catch (error) {
            console.error('Verification error:', error);
            throw error;
        }
    }

    showVerificationSuccess() {
        // Если мы на странице верификации, показываем успешное сообщение
        if (window.location.pathname === '/verify.html') {
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
                        <a href="/" class="btn-primary" style="display: inline-block;">
                            <i class="fas fa-home"></i> Вернуться на главную
                        </a>
                    </div>
                `;
            }
        }
    }

    showUserMenu() {
        const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        
        // Удаляем старое меню если есть
        const oldMenu = document.querySelector('.user-menu');
        if (oldMenu) oldMenu.remove();
        
        const menu = document.createElement('div');
        menu.className = 'user-menu';
        menu.style.cssText = `
            position: absolute;
            top: 100%;
            right: 0;
            background: #2a2b36;
            border-radius: 8px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
            padding: 1rem;
            min-width: 300px;
            z-index: 1000;
            margin-top: 10px;
        `;
        
        // Нормализуем бейджи
        const normalizedBadges = this.normalizeBadges(authData.badges);
        
        // Генерируем HTML для бейджей
        const badgesHtml = this.generateBadgesHTML(normalizedBadges);
        
        menu.innerHTML = `
            <div style="padding: 0.5rem; color: #b9bbbe; border-bottom: 1px solid #40444b; margin-bottom: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                    <img src="https://cdn.discordapp.com/avatars/${authData.id}/${authData.avatar}.png?size=64" 
                         style="width: 40px; height: 40px; border-radius: 50%;"
                         onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                    <div>
                        <div style="color: white; font-weight: 600; display: flex; align-items: center;">
                            ${authData.username}
                            ${normalizedBadges.verified ? `
                                <img src="https://cdn3.emoji.gg/emojis/32765-verifiedtwitter.gif" 
                                     style="width: 16px; height: 16px; margin-left: 5px; border-radius: 50%;" 
                                     title="Верифицированный аккаунт">
                            ` : ''}
                        </div>
                        <div style="font-size: 0.8rem; margin-top: 5px; display: flex; gap: 5px; flex-wrap: wrap;">
                            ${badgesHtml}
                        </div>
                        <div style="font-size: 0.8rem; margin-top: 5px;">ID: ${authData.id}</div>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                    <small>Баланс:</small>
                    <div style="color: #57F287; font-weight: 600; font-size: 1.2rem;">
                        ${authData.balance || 0} ₽
                    </div>
                </div>
            </div>
            <a href="/profile.html" style="display: flex; align-items: center; gap: 10px; padding: 0.75rem; color: white; text-decoration: none; border-radius: 4px; transition: background 0.3s;">
                <i class="fas fa-user" style="width: 20px;"></i>
                <span>Профиль</span>
            </a>
            <a href="/profile.html#orders" style="display: flex; align-items: center; gap: 10px; padding: 0.75rem; color: white; text-decoration: none; border-radius: 4px; transition: background 0.3s;">
                <i class="fas fa-shopping-bag" style="width: 20px;"></i>
                <span>Мои заказы</span>
            </a>
            <a href="/profile.html#balance" style="display: flex; align-items: center; gap: 10px; padding: 0.75rem; color: white; text-decoration: none; border-radius: 4px; transition: background 0.3s;">
                <i class="fas fa-coins" style="width: 20px;"></i>
                <span>Баланс</span>
            </a>
            ${this.isAdmin() ? `
                <a href="/admin.html" style="display: flex; align-items: center; gap: 10px; padding: 0.75rem; color: #5865F2; text-decoration: none; border-radius: 4px; transition: background 0.3s;">
                    <i class="fas fa-crown" style="width: 20px;"></i>
                    <span>Админ панель</span>
                </a>
            ` : ''}
            <hr style="border-color: #40444b; margin: 0.5rem 0;">
            <button onclick="DiscordAuth.instance.logout()" style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 0.75rem; background: none; border: none; color: #ED4245; text-align: left; cursor: pointer; border-radius: 4px; transition: background 0.3s;">
                <i class="fas fa-sign-out-alt" style="width: 20px;"></i>
                <span>Выйти</span>
            </button>
        `;
        
        const navAuth = document.querySelector('.nav-auth');
        if (navAuth) {
            navAuth.appendChild(menu);
            
            // Закрытие меню при клике вне его
            setTimeout(() => {
                const closeMenu = (e) => {
                    if (!menu.contains(e.target) && e.target !== document.getElementById('authBtn')) {
                        menu.remove();
                        document.removeEventListener('click', closeMenu);
                    }
                };
                document.addEventListener('click', closeMenu);
            }, 0);
        }
    }

    // Генерация HTML для бейджей в меню
    generateBadgesHTML(badges) {
        let badgesArray = [];
        
        // Верифицированный аккаунт
        if (badges.verified) {
            badgesArray.push(`
                <span style="background: #5865F2; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; display: inline-flex; align-items: center; gap: 3px;">
                    <img src="https://cdn3.emoji.gg/emojis/32765-verifiedtwitter.gif" style="width: 12px; height: 12px; border-radius: 50%;">
                    <span>Верифицирован</span>
                </span>
            `);
        }
        
        // Партнер
        if (badges.partner) {
            badgesArray.push(`
                <span style="background: #FEE75C; color: #1e1f29; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; display: inline-flex; align-items: center; gap: 3px;">
                    <img src="https://cdn3.emoji.gg/emojis/747328-serverpartner.png" style="width: 12px; height: 12px;">
                    <span>Партнёр</span>
                </span>
            `);
        }
        
        // Покупатель
        if (badges.buyer) {
            badgesArray.push(`
                <span style="background: #57F287; color: #1e1f29; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; display: inline-flex; align-items: center; gap: 3px;">
                    <img src="https://cdn3.emoji.gg/emojis/6133-buy.png" style="width: 12px; height: 12px;">
                    <span>Покупатель</span>
                </span>
            `);
        }
        
        return badgesArray.join(' ');
    }

    isAdmin() {
        const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        return authData.username === 'borisonchik_yt' || 
               authData.username === 'borisonchik' ||
               authData.global_name === 'borisonchik_yt';
    }

    logout() {
        localStorage.removeItem('bhstore_auth');
        localStorage.removeItem('bhstore_orders');
        window.location.reload();
    }

    generateVerificationCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
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
            console.error('Error getting user balance:', error);
        }
        return 0;
    }

    // Метод для обновления баланса в localStorage
    static updateLocalBalance(newBalance) {
        const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        if (authData.id) {
            authData.balance = newBalance;
            localStorage.setItem('bhstore_auth', JSON.stringify(authData));
            
            // Обновляем кнопку если она есть на странице
            const authBtn = document.getElementById('authBtn');
            if (authBtn && auth.instance) {
                auth.instance.updateAuthButton();
            }
        }
    }
}

// Создаем экземпляр и делаем его доступным глобально
const auth = new DiscordAuth();
window.DiscordAuth = DiscordAuth;
DiscordAuth.instance = auth;

// Автоматическое обновление кнопки при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    auth.updateAuthButton();
    
    // Также обновляем каждые 30 секунд на случай изменений
    setInterval(() => {
        auth.updateAuthButton();
    }, 30000);
});

// Глобальная функция logout для вызова из кнопок
window.logout = function() {
    auth.logout();
};

// Глобальная функция для обновления баланса
window.updateUserBalance = function(newBalance) {
    DiscordAuth.updateLocalBalance(newBalance);
};

// Проверяем авторизацию при загрузке
if (typeof checkAuth === 'function') {
    checkAuth();
}

// Отладочная функция
window.debugAuth = function() {
    const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
    console.log('Auth Data:', authData);
    console.log('Badges:', authData.badges);
    console.log('Badges Type:', typeof authData.badges);
};