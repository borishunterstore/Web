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
        
        // Инициализируем кнопку авторизации на всех страницах
        this.initAuthButton();
        
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
                    this.updateAuthButton();
                }
            } catch (error) {
                console.error('❌ Error refreshing balance:', error);
            }
        }
    }

    initAuthButton() {
        const authBtn = document.getElementById('authBtn');
        if (authBtn) {
            // Проверяем текущий статус авторизации
            this.updateAuthButton();
            
            // Если кнопка еще не имеет обработчика, добавляем его
            if (!authBtn.hasAttribute('data-auth-initialized')) {
                authBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const authData = this.getAuthData();
                    
                    if (authData?.username && !authData.requiresVerification) {
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

    async updateAuthButton() {
        const authBtn = document.getElementById('authBtn');
        if (!authBtn) return;
        
        const authData = this.getAuthData();
        
        if (authData?.username && !authData.requiresVerification) {
            // Получаем актуальные данные с сервера
            try {
                const userData = await this.fetchUserData(authData.id);
                if (userData) {
                    authData.balance = userData.balance;
                    authData.badges = userData.badges;
                    this.saveAuthData(authData);
                }
            } catch (error) {
                console.error('❌ Error fetching user data:', error);
            }
            
            // Получаем бейджи пользователя
            const badges = this.getUserBadgesHTML(authData);
            
            // Пользователь авторизован и верифицирован
            authBtn.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <img src="https://cdn.discordapp.com/avatars/${authData.id}/${authData.avatar}.png?size=32" 
                         style="width: 32px; height: 32px; border-radius: 50%;"
                         onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                    <span style="vertical-align: middle;">${authData.username}</span>
                    ${badges}
                    <span style="color: #57F287; font-weight: 600; margin-left: 5px;">${authData.balance || 0} ₽</span>
                    <i class="fas fa-chevron-down" style="margin-left: 5px; vertical-align: middle;"></i>
                </div>
            `;
        } else if (authData?.username && authData.requiresVerification) {
            // Пользователь авторизован, но не верифицирован
            authBtn.innerHTML = `
                <i class="fas fa-hourglass-half" style="color: #FEE75C;"></i>
                <span>Завершить регистрацию</span>
            `;
            authBtn.onclick = () => {
                window.location.href = '/verify.html';
            };
        } else {
            // Не авторизован
            authBtn.innerHTML = '<i class="fab fa-discord"></i> Войти через Discord';
        }
    }

getUserBadgesHTML(authData) {
    const badges = authData.badges || {};
    let badgeHtml = '';
    
    if (badges.admin) {
        badgeHtml = `
            <img src="https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F976977194939203645.gif%3Fv%3D1&w=64&q=75" 
                 style="width: 18px; height: 18px; margin-left: 6px; border-radius: 50%;" 
                 title="Администратор">
        `;
    } 
    else if (badges.verified) {
        badgeHtml = `
            <img src="https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F856587496154595348.gif%3Fv%3D1&w=64&q=75" 
                 style="width: 18px; height: 18px; margin-left: 6px; border-radius: 50%;" 
                 title="Верифицированный">
        `;
    } 
    else if (badges.partner) {
        badgeHtml = `
            <img src="https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F935501408323645470.gif%3Fv%3D1&w=64&q=75" 
                 style="width: 18px; height: 18px; margin-left: 6px;" 
                 title="Партнёр">
        `;
    } 
    else if (badges.buyer) {
        badgeHtml = `
            <img src="https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F915540288032886825.png%3Fv%3D1&w=64&q=75" 
                 style="width: 18px; height: 18px; margin-left: 6px;" 
                 title="Покупатель">
        `;
    }
    
    return badgeHtml;
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
                        // Обновляем кнопку авторизации
                        await this.updateAuthButton();
                        
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

    async showUserMenu() {
        const authData = this.getAuthData();
        if (!authData?.id) return;
        
        // Получаем актуальные данные с сервера
        const userData = await this.fetchUserData(authData.id);
        if (userData) {
            authData.balance = userData.balance;
            authData.badges = userData.badges;
            this.saveAuthData(authData);
        }
        
        // Удаляем старое меню если есть
        const oldMenu = document.querySelector('.user-menu');
        if (oldMenu) oldMenu.remove();
        
        const menu = document.createElement('div');
        menu.className = 'user-menu';
        
        // Генерируем HTML для бейджей (все бейджи)
        const allBadgesHtml = this.generateAllBadgesHTML(authData.badges || {});
        
        // Получаем главный бейдж для аватарки (только один по приоритету)
        const mainBadge = this.getMainBadge(authData.badges || {});
        
        // Проверяем админа
        const isAdmin = await this.isAdmin();
        
        menu.innerHTML = `
            <div class="user-menu-header">
                <div class="user-menu-user">
                    <div class="user-menu-avatar-wrapper">
                        <img src="https://cdn.discordapp.com/avatars/${authData.id}/${authData.avatar}.png?size=64" 
                             class="user-menu-avatar"
                             onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                        ${mainBadge}
                    </div>
                    <div class="user-menu-info">
                        <div class="user-menu-username">
                            ${this.escapeHtml(authData.username)}
                        </div>
                        <div class="user-menu-badges">
                            ${allBadgesHtml}
                        </div>
                        <div class="user-menu-id">
                            <i class="fas fa-hashtag"></i> ${authData.id}
                        </div>
                    </div>
                </div>
                <div class="user-menu-balance">
                    <span>Баланс</span>
                    <span class="user-menu-balance-amount">${authData.balance || 0} ₽</span>
                </div>
            </div>
            
            <div class="user-menu-items">
                <a href="/profile.html" class="user-menu-item">
                    <i class="fas fa-user"></i>
                    <span>Профиль</span>
                </a>
                <a href="/profile.html#orders" class="user-menu-item">
                    <i class="fas fa-shopping-bag"></i>
                    <span>Мои заказы</span>
                </a>
                <a href="/profile.html#balance" class="user-menu-item">
                    <i class="fas fa-coins"></i>
                    <span>Баланс</span>
                </a>
                ${isAdmin ? `
                    <a href="/admin.html" class="user-menu-item admin-item">
                        <i class="fas fa-crown"></i>
                        <span>Админ панель</span>
                        <span class="user-menu-badge">NEW</span>
                    </a>
                ` : ''}
                
                <div class="user-menu-divider"></div>
                
                <a href="/support.html" class="user-menu-item">
                    <i class="fas fa-headset"></i>
                    <span>Поддержка</span>
                </a>
                <a href="/faq.html" class="user-menu-item">
                    <i class="fas fa-question-circle"></i>
                    <span>FAQ</span>
                </a>
                
                <div class="user-menu-divider"></div>
                
                <button onclick="DiscordAuth.instance.logout()" class="user-menu-item logout-item">
                    <i class="fas fa-sign-out-alt"></i>
                    <span>Выйти</span>
                    <span class="user-menu-shortcut">Ctrl+Q</span>
                </button>
            </div>
        `;
        
        // Добавляем меню после кнопки авторизации
        const authBtn = document.getElementById('authBtn');
        if (authBtn) {
            authBtn.parentNode.style.position = 'relative';
            authBtn.parentNode.appendChild(menu);
            
            // Анимация появления
            setTimeout(() => menu.classList.add('active'), 10);
            
            // Закрытие меню при клике вне его
            const closeMenu = (e) => {
                if (!menu.contains(e.target) && e.target !== authBtn && !authBtn.contains(e.target)) {
                    menu.classList.remove('active');
                    setTimeout(() => menu.remove(), 300);
                    document.removeEventListener('click', closeMenu);
                }
            };
            
            setTimeout(() => {
                document.addEventListener('click', closeMenu);
            }, 0);
        }
    }
    
    // Функция для получения главного бейджа (только один по приоритету)
    getMainBadge(badges) {
        // Приоритет: Админ > Подтвержденный > Партнер > Покупатель
        if (badges.admin) {
            return `
                <div class="avatar-badge" title="Администратор">
                    <img src="https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F976977194939203645.gif%3Fv%3D1&w=64&q=75" 
                         alt="Admin">
                </div>
            `;
        } else if (badges.verified) {
            return `
                <div class="avatar-badge" title="Верифицированный">
                    <img src="https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F856587496154595348.gif%3Fv%3D1&w=64&q=75" 
                         alt="Verified">
                </div>
            `;
        } else if (badges.partner) {
            return `
                <div class="avatar-badge" title="Партнёр">
                    <img src="https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F935501408323645470.gif%3Fv%3D1&w=64&q=75" 
                         alt="Partner">
                </div>
            `;
        } else if (badges.buyer) {
            return `
                <div class="avatar-badge" title="Покупатель">
                    <img src="https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F915540288032886825.png%3Fv%3D1&w=64&q=75" 
                         alt="Buyer">
                </div>
            `;
        }
        return '';
    }
    
    // Функция для генерации всех бейджей (для отображения в списке)
    generateAllBadgesHTML(badges) {
        let badgesHtml = '';
        
        // Словарь бейджей с приоритетами
        const badgeConfigs = [
            { condition: badges.admin, class: 'admin', image: 'https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F976977194939203645.gif%3Fv%3D1&w=64&q=75', text: 'Админ', priority: 1 },
            { condition: badges.verified, class: 'verified', image: 'https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F856587496154595348.gif%3Fv%3D1&w=64&q=75', text: 'Verified', priority: 2 },
            { condition: badges.partner, class: 'partner', image: 'https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F935501408323645470.gif%3Fv%3D1&w=64&q=75', text: 'Partner', priority: 3 },
            { condition: badges.buyer, class: 'buyer', image: 'https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F915540288032886825.png%3Fv%3D1&w=64&q=75', text: 'Buyer', priority: 4 }
        ];
        
        // Сортируем по приоритету
        const sortedConfigs = badgeConfigs.sort((a, b) => a.priority - b.priority);
        
        sortedConfigs.forEach(config => {
            if (config.condition) {
                badgesHtml += `
                    <div class="badge-icon" title="${config.text}">
                        <img src="${config.image}" alt="${config.text}">
                    </div>
                `;
            }
        });
        
        return badgesHtml;
    }
    
    // Вспомогательная функция для экранирования HTML
    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Генерация HTML для бейджей в меню
    generateBadgesHTML(badges) {
        let badgesArray = [];
        
        if (badges.admin) {
            badgesArray.push(`
                <span style="background: #ED4245; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; display: inline-flex; align-items: center; gap: 3px;">
                    <i class="fas fa-crown" style="font-size: 10px;"></i>
                    <span>Админ</span>
                </span>
            `);
        }
        
        if (badges.verified) {
            badgesArray.push(`
                <span style="background: #5865F2; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; display: inline-flex; align-items: center; gap: 3px;">
                    <img src="https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F856587496154595348.gif%3Fv%3D1&w=64&q=75" style="width: 12px; height: 12px; border-radius: 50%;">
                    <span>Верифицирован</span>
                </span>
            `);
        }
        
        if (badges.partner) {
            badgesArray.push(`
                <span style="background: #FEE75C; color: #1e1f29; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; display: inline-flex; align-items: center; gap: 3px;">
                    <img src="https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F935501408323645470.gif%3Fv%3D1&w=64&q=75" style="width: 12px; height: 12px;">
                    <span>Партнёр</span>
                </span>
            `);
        }
        
        if (badges.buyer) {
            badgesArray.push(`
                <span style="background: #57F287; color: #1e1f29; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; display: inline-flex; align-items: center; gap: 3px;">
                    <img src="https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F915540288032886825.png%3Fv%3D1&w=64&q=75" style="width: 12px; height: 12px;">
                    <span>Покупатель</span>
                </span>
            `);
        }
        
        return badgesArray.join(' ');
    }

    isAdmin() {
        const authData = this.getAuthData();
        return authData?.badges?.admin === true;
    }

    logout() {
        localStorage.removeItem('bhstore_auth');
        localStorage.removeItem('discord_oauth_state');
        window.location.reload();
    }

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
                instance.updateAuthButton();
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
    setInterval(async () => {
        await auth.refreshUserBalance();
        auth.updateAuthButton();
    }, 30000);
});

// Глобальная функция logout для вызова из кнопок
window.logout = function() {
    auth.logout();
};

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