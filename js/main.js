document.addEventListener('DOMContentLoaded', function() {
    
    // Проверка авторизации и загрузка данных
    checkAuth().then(() => {
        if (document.getElementById('popularProducts')) loadPopularProducts();
        if (document.getElementById('latestNews')) loadLatestNews();
    });
    
    // Мобильное меню
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    }
    
    // Инициализация промокодов
    setTimeout(() => {
        if (window.promocodeSystem?.updateActivePromocodesUI) {
            window.promocodeSystem.updateActivePromocodesUI();
        }
    }, 1000);
});

// ========== АВТОРИЗАЦИЯ ==========

// ========== УЛУЧШЕННАЯ ПРОВЕРКА АВТОРИЗАЦИИ ==========

async function checkAuth() {
    const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
    const authBtn = document.getElementById('authBtn');
    if (!authBtn) return;

    // Если есть токен, обновляем данные через API
    if (authData.token && authData.id && window.api) {
        try {
            const data = await window.api.getUser(authData.id);
            if (data?.success && data.user) {
                Object.assign(authData, {
                    username: data.user.username,
                    avatar: data.user.avatar,
                    balance: data.user.balance,
                    badges: data.user.badges || {},
                    discordId: data.user.discordId,
                    registeredAt: data.user.registeredAt
                });
                localStorage.setItem('bhstore_auth', JSON.stringify(authData));
            }
        } catch (error) {
            console.error('❌ Ошибка обновления пользователя:', error);
        }
    }

    // Обновляем интерфейс
    if (authData.username && !authData.verificationCode) {
        // Авторизован
        const badges = getUserBadges(authData);
        const mainBadge = getMainBadgeForButton(authData.badges);
        
        // Получаем актуальный баланс
        try {
            const balanceData = await window.api?.getUserBalance(authData.id);
            if (balanceData?.success) {
                authData.balance = balanceData.balance;
                localStorage.setItem('bhstore_auth', JSON.stringify(authData));
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки баланса:', error);
        }

        // Формируем URL аватара с учетом анимированных аватарок
        let avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';
        if (authData.avatar) {
            if (authData.avatar.startsWith('a_')) {
                avatarUrl = `https://cdn.discordapp.com/avatars/${authData.id}/${authData.avatar}.gif?size=64`;
            } else {
                avatarUrl = `https://cdn.discordapp.com/avatars/${authData.id}/${authData.avatar}.png?size=64`;
            }
        }

        authBtn.innerHTML = `
            <div class="auth-button-content">
                <div class="auth-avatar-wrapper">
                    <img src="${avatarUrl}" 
                         class="auth-avatar-img"
                         alt="Avatar"
                         loading="lazy"
                         onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                    ${mainBadge ? `<span class="auth-badge-icon">${mainBadge}</span>` : ''}
                </div>
                <span class="auth-username">${escapeHtml(authData.username)}</span>
                ${badges ? `<span class="auth-badges">${badges}</span>` : ''}
                <div class="auth-balance-indicator">
                    <i class="fas fa-coins"></i>
                    <span>${authData.balance || 0}</span>
                </div>
                <i class="fas fa-chevron-down auth-chevron"></i>
            </div>
        `;
        
        authBtn.classList.add('auth-authenticated');
        authBtn.onclick = (e) => {
            e.stopPropagation();
            showUserMenu(e);
        };
        
    } else if (authData.username && authData.verificationCode) {
        // Требуется верификация
        authBtn.innerHTML = `
            <div class="auth-button-content">
                <div class="auth-verification-icon">
                    <i class="fas fa-hourglass-half"></i>
                </div>
                <span class="auth-verification-text">Завершить регистрацию</span>
                <span class="auth-verification-badge">!</span>
            </div>
        `;
        authBtn.classList.add('auth-verification');
        authBtn.onclick = () => window.location.href = '/verify.html';
    } else {
        // Не авторизован
        authBtn.innerHTML = `
            <div class="auth-button-content">
                <div class="auth-discord-icon">
                    <i class="fab fa-discord"></i>
                </div>
                <span class="auth-login-text">Войти через Discord</span>
                <span class="auth-login-hint">нажмите для входа</span>
            </div>
        `;
        authBtn.classList.remove('auth-authenticated', 'auth-verification');
        authBtn.onclick = () => window.location.href = '/auth.html';
    }
}

// ========== ФУНКЦИИ ДЛЯ БЕЙДЖЕЙ ==========

function normalizeBadges(badgesData) {
    if (!badgesData) {
        return {
            admin: false,
            verified: false,
            partner: false,
            buyer: false,
            early: false,
            vip: false
        };
    }
    
    if (typeof badgesData === 'string') {
        return {
            admin: badgesData === 'admin',
            verified: badgesData === 'verified',
            partner: false,
            buyer: false,
            early: false,
            vip: false
        };
    }
    
    if (typeof badgesData === 'object') {
        return {
            admin: !!badgesData.admin,
            verified: !!badgesData.verified,
            partner: !!badgesData.partner,
            buyer: !!badgesData.buyer,
            early: !!badgesData.early,
            vip: !!badgesData.vip
        };
    }
    
    return {
        admin: false,
        verified: false,
        partner: false,
        buyer: false,
        early: false,
        vip: false
    };
}

function getMainBadgeForButton(badgesData) {
    const badges = normalizeBadges(badgesData);
    
    // Приоритет: Админ > Подтвержденный > Партнер > Покупатель > VIP > Ранний
    if (badges.admin) {
        return `<img src="${BADGE_CONFIG.admin.image}" alt="Admin" class="badge-icon-img" title="Администратор">`;
    } else if (badges.verified) {
        return `<img src="${BADGE_CONFIG.verified.image}" alt="Verified" class="badge-icon-img" title="Верифицированный">`;
    } else if (badges.partner) {
        return `<img src="${BADGE_CONFIG.partner.image}" alt="Partner" class="badge-icon-img" title="Партнёр">`;
    } else if (badges.buyer) {
        return `<img src="${BADGE_CONFIG.buyer.image}" alt="Buyer" class="badge-icon-img" title="Покупатель">`;
    } else if (badges.vip) {
        return `<img src="${BADGE_CONFIG.vip.image}" alt="VIP" class="badge-icon-img" title="VIP">`;
    } else if (badges.early) {
        return `<img src="${BADGE_CONFIG.early.image}" alt="Early" class="badge-icon-img" title="Ранний сторонник">`;
    }
    
    return '';
}

function getUserBadges(authData) {
    const badges = normalizeBadges(authData.badges);
    let badgesHtml = '';
    
    // Сортируем по приоритету
    const sortedBadges = Object.entries(badges)
        .filter(([key, value]) => value && BADGE_CONFIG[key])
        .sort((a, b) => BADGE_CONFIG[a[0]].priority - BADGE_CONFIG[b[0]].priority);
    
    sortedBadges.forEach(([badgeKey]) => {
        const config = BADGE_CONFIG[badgeKey];
        badgesHtml += `<img src="${config.image}" alt="${config.name}" class="badge-icon-img-small" title="${config.name}">`;
    });
    
    return badgesHtml;
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ========== МЕНЮ ПОЛЬЗОВАТЕЛЯ ==========

async function showUserMenu(event) {
    const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
    if (!authData.id) return;

    // Предотвращаем всплытие события
    if (event) {
        event.stopPropagation();
    }

    // Обновляем данные
    try {
        const data = await window.api?.getUser(authData.id);
        if (data?.success && data.user) {
            authData.balance = data.user.balance;
            authData.badges = data.user.badges;
            localStorage.setItem('bhstore_auth', JSON.stringify(authData));
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки для меню:', error);
    }

    // Удаляем старое меню
    const existingMenu = document.querySelector('.user-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    // Получаем кнопку для позиционирования
    const authBtn = document.getElementById('authBtn');
    if (!authBtn) return;

    const btnRect = authBtn.getBoundingClientRect();
    const isMobile = window.innerWidth <= 768;

    // Нормализуем бейджи
    const badges = normalizeBadges(authData.badges);
    const mainBadge = getMainBadgeHTML(badges);
    const allBadges = generateAllBadgesHTML(badges);
    const isAdminUser = await isAdmin();

    // Создаем меню
    const menu = document.createElement('div');
    menu.className = 'user-menu';
    
    // Добавляем класс для мобильной версии
    if (isMobile) {
        menu.classList.add('user-menu-mobile');
    }

    // Позиционирование для десктопа
    if (!isMobile) {
        menu.style.top = `${btnRect.bottom + window.scrollY + 5}px`;
        menu.style.left = `${btnRect.left + (btnRect.width / 2)}px`;
    }

    // Формируем HTML меню с улучшенным дизайном
    menu.innerHTML = `
        <div class="user-menu-header">
            <div class="user-menu-avatar-wrapper">
                <img src="https://cdn.discordapp.com/avatars/${authData.id}/${authData.avatar}.png?size=64" 
                     class="user-menu-avatar"
                     onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                ${mainBadge ? `<div class="user-menu-avatar-badge">${mainBadge}</div>` : ''}
            </div>
            <div class="user-menu-user-info">
                <div class="user-menu-username">
                    ${escapeHtml(authData.username)}
                    ${mainBadge ? `<span class="user-menu-badge-icon">${mainBadge}</span>` : ''}
                </div>
                <div class="user-menu-user-id">ID: ${authData.id}</div>
                <div class="user-menu-badges-container">
                    ${allBadges}
                </div>
            </div>
            <button class="user-menu-close" onclick="this.closest('.user-menu').remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>

        <div class="user-menu-balance">
            <div class="user-menu-balance-label">
                <i class="fas fa-wallet"></i>
                Баланс
            </div>
            <div class="user-menu-balance-amount">
                ${authData.balance || 0} ₽
            </div>
        </div>

        <div class="user-menu-nav">
            <a href="/profile.html" class="user-menu-item">
                <div class="user-menu-item-icon">
                    <i class="fas fa-user"></i>
                </div>
                <div class="user-menu-item-content">
                    <div class="user-menu-item-title">Профиль</div>
                    <div class="user-menu-item-desc">Ваша личная информация</div>
                </div>
                <i class="fas fa-chevron-right user-menu-item-arrow"></i>
            </a>

            <a href="/profile.html#orders" class="user-menu-item">
                <div class="user-menu-item-icon">
                    <i class="fas fa-shopping-bag"></i>
                </div>
                <div class="user-menu-item-content">
                    <div class="user-menu-item-title">Мои заказы</div>
                    <div class="user-menu-item-desc">История покупок</div>
                </div>
                <i class="fas fa-chevron-right user-menu-item-arrow"></i>
            </a>

            <a href="/profile.html#balance" class="user-menu-item">
                <div class="user-menu-item-icon">
                    <i class="fas fa-coins"></i>
                </div>
                <div class="user-menu-item-content">
                    <div class="user-menu-item-title">Баланс</div>
                    <div class="user-menu-item-desc">Пополнение и история</div>
                </div>
                <i class="fas fa-chevron-right user-menu-item-arrow"></i>
            </a>

            ${isAdminUser ? `
                <a href="/admin.html" class="user-menu-item user-menu-item-admin">
                    <div class="user-menu-item-icon">
                        <i class="fas fa-crown"></i>
                    </div>
                    <div class="user-menu-item-content">
                        <div class="user-menu-item-title">Админ панель</div>
                        <div class="user-menu-item-desc">Управление магазином</div>
                    </div>
                    <span class="user-menu-item-badge">Admin</span>
                </a>
            ` : ''}
        </div>

        <div class="user-menu-footer">
            <button onclick="logout()" class="user-menu-logout-btn">
                <i class="fas fa-sign-out-alt"></i>
                Выйти из аккаунта
            </button>
        </div>
    `;

    // Добавляем меню в DOM
    document.body.appendChild(menu);

    // Анимация появления
    setTimeout(() => {
        menu.classList.add('user-menu-visible');
    }, 10);

    // Закрытие по клику вне меню
    const closeMenu = (e) => {
        if (!menu.contains(e.target) && e.target !== authBtn && !authBtn.contains(e.target)) {
            menu.classList.remove('user-menu-visible');
            setTimeout(() => {
                menu.remove();
            }, 300);
            document.removeEventListener('click', closeMenu);
        }
    };

    // Добавляем задержку, чтобы не закрылось сразу
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 100);

    // Закрытие по ESC
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            menu.classList.remove('user-menu-visible');
            setTimeout(() => {
                menu.remove();
            }, 300);
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

// ========== ФУНКЦИИ ДЛЯ БЕЙДЖЕЙ ==========

const BADGE_CONFIG = {
    admin: {
        name: 'Администратор',
        icon: 'fas fa-crown',
        image: 'https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F976977194939203645.gif%3Fv%3D1&w=64&q=75',
        color: '#FFD700',
        bgColor: 'rgba(255, 215, 0, 0.15)',
        priority: 1
    },
    verified: {
        name: 'Верифицированный',
        icon: 'fas fa-check-circle',
        image: 'https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F856587496154595348.gif%3Fv%3D1&w=64&q=75',
        color: '#57F287',
        bgColor: 'rgba(87, 242, 135, 0.15)',
        priority: 2
    },
    partner: {
        name: 'Партнёр',
        icon: 'fas fa-handshake',
        image: 'https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F935501408323645470.gif%3Fv%3D1&w=64&q=75',
        color: '#FF73FA',
        bgColor: 'rgba(255, 115, 250, 0.15)',
        priority: 3
    },
    buyer: {
        name: 'Покупатель',
        icon: 'fas fa-shopping-bag',
        image: 'https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F915540288032886825.png%3Fv%3D1&w=64&q=75',
        color: '#FEE75C',
        bgColor: 'rgba(254, 231, 92, 0.15)',
        priority: 4
    },
    early: {
        name: 'Ранний сторонник',
        icon: 'fas fa-star',
        image: 'https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F1085815477030092860.png%3Fv%3D1&w=64&q=75',
        color: '#5865F2',
        bgColor: 'rgba(88, 101, 242, 0.15)',
        priority: 5
    },
    vip: {
        name: 'VIP',
        icon: 'fas fa-gem',
        image: 'https://discords.com/_next/image?url=https%3A%2F%2Fcdn.discordapp.com%2Femojis%2F1074074255389896764.png%3Fv%3D1&w=64&q=75',
        color: '#9B59B6',
        bgColor: 'rgba(155, 89, 182, 0.15)',
        priority: 6
    }
};

function normalizeBadges(badgesData) {
    if (!badgesData) {
        return {
            admin: false,
            verified: false,
            partner: false,
            buyer: false,
            early: false,
            vip: false
        };
    }
    
    if (typeof badgesData === 'string') {
        return {
            admin: badgesData === 'admin',
            verified: badgesData === 'verified',
            partner: false,
            buyer: false,
            early: false,
            vip: false
        };
    }
    
    if (typeof badgesData === 'object') {
        return {
            admin: !!badgesData.admin,
            verified: !!badgesData.verified,
            partner: !!badgesData.partner,
            buyer: !!badgesData.buyer,
            early: !!badgesData.early,
            vip: !!badgesData.vip
        };
    }
    
    return {
        admin: false,
        verified: false,
        partner: false,
        buyer: false,
        early: false,
        vip: false
    };
}

function getMainBadgeHTML(badges) {
    // Сортируем по приоритету и берем первый активный
    const sortedBadges = Object.entries(badges)
        .filter(([key, value]) => value && BADGE_CONFIG[key])
        .sort((a, b) => BADGE_CONFIG[a[0]].priority - BADGE_CONFIG[b[0]].priority);
    
    if (sortedBadges.length === 0) return '';
    
    const [badgeKey] = sortedBadges[0];
    const config = BADGE_CONFIG[badgeKey];
    
    return `<img src="${config.image}" alt="${config.name}" style="width: 16px; height: 16px; border-radius: 50%;">`;
}

function generateAllBadgesHTML(badges) {
    let html = '';
    
    // Сортируем по приоритету
    const sortedBadges = Object.entries(badges)
        .filter(([key, value]) => value && BADGE_CONFIG[key])
        .sort((a, b) => BADGE_CONFIG[a[0]].priority - BADGE_CONFIG[b[0]].priority);
    
    sortedBadges.forEach(([badgeKey]) => {
        const config = BADGE_CONFIG[badgeKey];
        html += `
            <div class="user-menu-badge" style="background: ${config.bgColor}; color: ${config.color};">
                <img src="${config.image}" alt="${config.name}" style="width: 14px; height: 14px;">
                <span>${config.name}</span>
            </div>
        `;
    });
    
    return html;
}

function getUserBadges(authData) {
    const badges = normalizeBadges(authData.badges);
    const mainBadge = getMainBadgeHTML(badges);
    
    if (mainBadge) {
        return `<span class="user-badge-icon">${mainBadge}</span>`;
    }
    
    return '';
}

// Вспомогательная функция для экранирования HTML
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ========== ПРОВЕРКА АДМИНА ==========

async function isAdmin() {
    const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
    
    if (authData.token && window.api) {
        try {
            return await window.api.isAdmin();
        } catch (error) {
            console.error('❌ Ошибка проверки админа:', error);
        }
    }
    
    // Fallback для разработки
    return authData.id === '992442453833547886' || authData.discordId === '830087428214751284';
}

// ========== ЗАГРУЗКА НОВОСТЕЙ ==========

async function loadLatestNews() {
    try {
        const data = await window.api.getNews();
        if (!data?.success) return;

        const latest = data.news.slice(0, 3);
        const container = document.getElementById('latestNews');
        if (!container) return;

        container.innerHTML = latest.map(news => `
            <div class="news-card">
                <div class="news-content">
                    <div class="news-date">${news.date}</div>
                    <span class="news-tag">${news.category}</span>
                    ${news.image ? `<img src="${news.image}" style="width: 100%; border-radius: 10%;">` : ''}
                    <h3>${news.title}</h3>
                    <p style="color: #b9bbbe;">${news.content.substring(0, 100)}...</p>
                    <a href="/news.html" style="color: #5865F2;">Читать далее →</a>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('❌ Ошибка загрузки новостей:', error);
    }
}

// ========== ПОКУПКА ТОВАРА ==========

function buyProduct(productId, productName, originalPrice) {
    const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
    
    if (!authData.username) {
        alert('Пожалуйста, авторизуйтесь');
        window.location.href = '/auth.html';
        return;
    }
    
    if (authData.verificationCode) {
        alert('Завершите регистрацию');
        window.location.href = '/verify.html';
        return;
    }

    // Проверяем баланс через API
    window.api.getUser(authData.id)
        .then(data => {
            if (!data?.success || !data.user) throw new Error('Нет данных пользователя');
            
            const userBalance = data.user.balance || 0;
            const finalPrice = window.paymentSystem?.calculateDiscountedPrice(originalPrice, productId) || originalPrice;

            if (userBalance < finalPrice) {
                if (window.paymentSystem) {
                    window.paymentSystem.showInsufficientFundsModal(finalPrice, userBalance, productName);
                } else {
                    alert(`Недостаточно средств: нужно ${finalPrice} ₽, у вас ${userBalance} ₽`);
                }
                return;
            }

            if (window.paymentSystem) {
                window.paymentSystem.showPaymentModal(productName, originalPrice, productId);
            } else {
                // Динамическая загрузка payment.js
                const script = document.createElement('script');
                script.src = '/js/payment.js';
                script.onload = () => window.paymentSystem?.showPaymentModal(productName, originalPrice, productId);
                document.head.appendChild(script);
            }
        })
        .catch(error => {
            console.error('❌ Ошибка покупки:', error);
            alert('Ошибка: ' + error.message);
        });
}

// ========== СОЗДАНИЕ ЗАКАЗА ==========

async function createOrder(productId, productName, price) {
    try {
        const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        
        const data = await window.api.createOrder({
            userId: authData.id,
            productId,
            productName,
            price,
            username: authData.username
        });

        if (data?.success) {
            // Обновляем баланс
            const balanceData = await window.api.getUserBalance(authData.id);
            if (balanceData?.success) {
                authData.balance = balanceData.balance;
                localStorage.setItem('bhstore_auth', JSON.stringify(authData));
            }
            
            checkAuth();
            
            if (window.paymentSystem) {
                window.paymentSystem.showSuccessMessage(data.orderId, productName, authData.balance);
            } else {
                alert(`Заказ #${data.orderId} создан!`);
            }
        } else {
            alert('Ошибка: ' + (data?.error || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('❌ Ошибка заказа:', error);
        alert('Ошибка при создании заказа');
    }
}

// ========== УТИЛИТЫ ==========

function toggleMobileMenu() {
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) {
        navMenu.style.display = navMenu.style.display === 'flex' ? 'none' : 'flex';
    }
}

function updateHomePagePrices() {
    document.querySelectorAll('#popularProducts .product-card').forEach(card => {
        const productId = card.querySelector('.btn-buy')?.dataset.productId;
        const originalPrice = parseFloat(card.querySelector('.btn-buy')?.dataset.price);
        
        if (productId && originalPrice && window.paymentSystem) {
            const finalPrice = window.paymentSystem.calculateDiscountedPrice(originalPrice, productId);
            const priceElement = card.querySelector('.product-price');
            if (priceElement) priceElement.textContent = `${finalPrice} ₽`;
        }
    });
}

function logout() {
    if (window.api) {
        window.api.logout();
    } else {
        localStorage.removeItem('bhstore_auth');
        localStorage.removeItem('bhstore_orders');
        localStorage.removeItem('bhstore_active_promocodes');
        window.location.reload();
    }
}

// Функция-мост для вызова из shop.js
window.buyProductFromMain = function(productId, productName, price) {
    console.log('🛒 buyProductFromMain вызван из main.js:', { productId, productName, price });
    
    // Проверяем авторизацию
    const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
    
    if (!authData.username) {
        alert('Пожалуйста, авторизуйтесь');
        window.location.href = '/auth.html';
        return;
    }
    
    if (authData.verificationCode) {
        alert('Завершите регистрацию');
        window.location.href = '/verify.html';
        return;
    }

    // Проверяем баланс через API
    window.api.getUser(authData.id)
        .then(data => {
            if (!data?.success || !data.user) throw new Error('Нет данных пользователя');
            
            const userBalance = data.user.balance || 0;
            const finalPrice = window.paymentSystem?.calculateDiscountedPrice(price, productId) || price;

            if (userBalance < finalPrice) {
                if (window.paymentSystem && window.paymentSystem.showInsufficientFundsModal) {
                    window.paymentSystem.showInsufficientFundsModal(finalPrice, userBalance, productName);
                } else {
                    alert(`Недостаточно средств: нужно ${finalPrice} ₽, у вас ${userBalance} ₽`);
                }
                return;
            }

            if (window.paymentSystem && window.paymentSystem.showPaymentModal) {
                window.paymentSystem.showPaymentModal(productName, price, productId);
            } else {
                // Динамическая загрузка payment.js
                const script = document.createElement('script');
                script.src = '/js/payment.js';
                script.onload = () => {
                    if (window.paymentSystem?.showPaymentModal) {
                        window.paymentSystem.showPaymentModal(productName, price, productId);
                    } else {
                        alert('Система оплаты временно недоступна');
                    }
                };
                document.head.appendChild(script);
            }
        })
        .catch(error => {
            console.error('❌ Ошибка покупки:', error);
            alert('Ошибка: ' + error.message);
        });
};

// Убедимся, что оригинальная функция тоже доступна
if (typeof window.buyProduct !== 'function') {
    window.buyProduct = buyProduct;
}

// Также убедитесь, что оригинальная функция buyProduct тоже доступна глобально
// (она уже должна быть, но на всякий случай)
if (typeof window.buyProduct !== 'function') {
    window.buyProductFromMain = buyProduct;
    window.buyProduct = buyProduct; // оставьте и старую для совместимости
}

// Глобальные функции
window.showUserMenu = showUserMenu;
window.logout = logout;
window.buyProduct = buyProduct;
window.isAdmin = isAdmin;

// Стили для меню
const style = document.createElement('style');
style.textContent = `
    .menu-item {
        display: flex; align-items: center; gap: 10px; padding: 0.75rem;
        color: white; text-decoration: none; border-radius: 4px;
        transition: background 0.3s; background: none; border: none; cursor: pointer;
    }
    .menu-item:hover { background: #40444b; }
`;
document.head.appendChild(style);
