document.addEventListener('DOMContentLoaded', function() {
    checkAuth().then(() => {
        if (document.getElementById('popularProducts')) loadPopularProducts();
        if (document.getElementById('latestNews')) loadLatestNews();
    });
    
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    }
    
    // Закрываем меню при клике вне его
    document.addEventListener('click', function(e) {
        const menu = document.querySelector('.user-menu');
        const authBtn = document.getElementById('authBtn');
        if (menu && !menu.contains(e.target) && e.target !== authBtn && !authBtn?.contains(e.target)) {
            menu.classList.remove('user-menu-visible');
            setTimeout(() => menu.remove(), 300);
        }
    });
    
    setTimeout(() => {
        if (window.promocodeSystem?.updateActivePromocodesUI) {
            window.promocodeSystem.updateActivePromocodesUI();
        }
    }, 1000);
});

// ========== КОНФИГУРАЦИЯ БЕЙДЖЕЙ ==========
const BADGE_CONFIG = {
    admin: {name: 'Администратор', image: '/image/BADGE/admin.png', color: '#FFD700', bgColor: 'rgba(255, 215, 0, 0.15)', priority: 1},
    verified: {name: 'Верифицированный', image: '/image/BADGE/verified.gif', color: '#57F287', bgColor: 'rgba(87, 242, 135, 0.15)', priority: 2},
    partner: {name: 'Партнёр', image: '/image/BADGE/partner.png', color: '#FF73FA', bgColor: 'rgba(255, 115, 250, 0.15)', priority: 3},
    buyer: {name: 'Покупатель', image: '/image/BADGE/buy.gif', color: '#FEE75C', bgColor: 'rgba(254, 231, 92, 0.15)', priority: 4},
    early: {name: 'Ранний сторонник', image: '/image/BADGE/early.png', color: '#5865F2', bgColor: 'rgba(88, 101, 242, 0.15)', priority: 5},
    vip: {name: 'VIP', image: '/image/BADGE/vip.png', color: '#9B59B6', bgColor: 'rgba(155, 89, 182, 0.15)', priority: 6}
};

// ========== УТИЛИТЫ ==========
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function normalizeBadges(badgesData) {
    if (!badgesData) return { admin: false, verified: false, partner: false, buyer: false, early: false, vip: false };
    
    if (typeof badgesData === 'string') {
        return {
            admin: badgesData === 'admin',
            verified: badgesData === 'verified',
            partner: false, buyer: false, early: false, vip: false
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
    
    return { admin: false, verified: false, partner: false, buyer: false, early: false, vip: false };
}

// ========== АВТОРИЗАЦИЯ ==========
async function checkAuth() {
    const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
    const authBtn = document.getElementById('authBtn');
    if (!authBtn) return;

    // Если есть токен, но нет данных пользователя - запрашиваем через /api/user/me
    if (authData.token && !authData.username) {
        try {
            const response = await fetch('/api/user/me', {
                headers: { 'Authorization': `Bearer ${authData.token}` }
            });
            const data = await response.json();
            
            if (data.success && data.user) {
                authData.id = data.user.discordId;
                authData.username = data.user.username;
                authData.avatar = data.user.avatar;
                authData.balance = data.user.balance;
                authData.badges = data.user.badges || {};
                localStorage.setItem('bhstore_auth', JSON.stringify(authData));
            }
        } catch (error) {
            console.error('❌ Ошибка обновления пользователя:', error);
        }
    }

    if (authData.username && !authData.verificationCode) {
        // Обновляем баланс
        try {
            const balanceData = await fetch(`/api/user/${authData.id}/balance`, {
                headers: { 'Authorization': `Bearer ${authData.token}` }
            });
            const balanceResult = await balanceData.json();
            if (balanceResult.success && balanceResult.balance !== undefined) {
                authData.balance = balanceResult.balance;
                localStorage.setItem('bhstore_auth', JSON.stringify(authData));
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки баланса:', error);
        }

        let avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';
        if (authData.avatar) {
            if (authData.avatar.startsWith('a_')) {
                avatarUrl = `https://cdn.discordapp.com/avatars/${authData.id}/${authData.avatar}.gif?size=64`;
            } else {
                avatarUrl = `https://cdn.discordapp.com/avatars/${authData.id}/${authData.avatar}.png?size=64`;
            }
        }

        const badges = normalizeBadges(authData.badges);
        const mainBadge = getMainBadgeHTML(badges);
        const badgesHtml = getUserBadgesHTML(badges);

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
                ${badgesHtml ? `<span class="auth-badges">${badgesHtml}</span>` : ''}
                <div class="auth-balance-indicator">
                    <i class="fas fa-coins"></i>
                    <span>${authData.balance || 0}</span>
                </div>
                <i class="fas fa-chevron-down auth-chevron"></i>
            </div>`;
        
        authBtn.classList.add('auth-authenticated');
        authBtn.onclick = (e) => {
            e.stopPropagation();
            showUserMenu(e);
        };
        
    } else if (authData.username && authData.verificationCode) {
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

function getMainBadgeHTML(badges) {
    const sortedBadges = Object.entries(badges)
        .filter(([key, value]) => value && BADGE_CONFIG[key])
        .sort((a, b) => BADGE_CONFIG[a[0]].priority - BADGE_CONFIG[b[0]].priority);
    
    if (sortedBadges.length === 0) return '';
    
    const [badgeKey] = sortedBadges[0];
    const config = BADGE_CONFIG[badgeKey];
    
    return `<img src="${config.image}" alt="${config.name}" style="width: 20px; height: 20px; border-radius: 50%;">`;
}

function getUserBadgesHTML(badges) {
    const sortedBadges = Object.entries(badges)
        .filter(([key, value]) => value && BADGE_CONFIG[key])
        .sort((a, b) => BADGE_CONFIG[a[0]].priority - BADGE_CONFIG[b[0]].priority);
    
    let html = '';
    sortedBadges.forEach(([badgeKey]) => {
        const config = BADGE_CONFIG[badgeKey];
        html += `<img src="${config.image}" alt="${config.name}" class="badge-icon-img-small" title="${config.name}" style="width: 16px; height: 16px;">`;
    });
    
    return html;
}

// ========== МЕНЮ ПОЛЬЗОВАТЕЛЯ (ФИКСИРОВАННОЕ ПОЛОЖЕНИЕ) ==========
async function showUserMenu(event) {
    const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
    if (!authData.id) return;
    if (event) event.stopPropagation();

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

    const existingMenu = document.querySelector('.user-menu');
    if (existingMenu) existingMenu.remove();

    const authBtn = document.getElementById('authBtn');
    if (!authBtn) return;

    const btnRect = authBtn.getBoundingClientRect();
    const isMobile = window.innerWidth <= 768;
    const badges = normalizeBadges(authData.badges);
    const mainBadge = getMainBadgeHTML(badges);
    const allBadges = generateAllBadgesHTML(badges);
    const isAdminUser = await isAdmin();

    const menu = document.createElement('div');
    menu.className = 'user-menu';
    if (isMobile) menu.classList.add('user-menu-mobile');

    // ФИКС: Привязываем меню к кнопке, а не к позиции на экране
    if (!isMobile) {
        menu.style.position = 'fixed';
        menu.style.top = `${btnRect.bottom + 5}px`;
        menu.style.left = `${btnRect.left + (btnRect.width / 2)}px`;
        menu.style.transform = 'translateX(-50%)';
    }

    let avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';
    if (authData.avatar) {
        avatarUrl = `https://cdn.discordapp.com/avatars/${authData.id}/${authData.avatar}.png?size=128`;
    }

    menu.innerHTML = `
        <div class="user-menu-header">
            <div class="user-menu-avatar-wrapper">
                <img src="${avatarUrl}" class="user-menu-avatar" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                ${mainBadge ? `<div class="user-menu-avatar-badge">${mainBadge}</div>` : ''}
            </div>
            <div class="user-menu-user-info">
                <div class="user-menu-username">
                    ${escapeHtml(authData.username)}
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
                <i class="fas fa-wallet"></i> Баланс
            </div>
            <div class="user-menu-balance-amount">
                ${authData.balance || 0} ₽
            </div>
        </div>

        <div class="user-menu-nav">
            <a href="/profile.html" class="user-menu-item">
                <div class="user-menu-item-icon"><i class="fas fa-user"></i></div>
                <div class="user-menu-item-content">
                    <div class="user-menu-item-title">Профиль</div>
                    <div class="user-menu-item-desc">Ваша личная информация</div>
                </div>
                <i class="fas fa-chevron-right user-menu-item-arrow"></i>
            </a>
            <a href="/profile.html#orders" class="user-menu-item">
                <div class="user-menu-item-icon"><i class="fas fa-shopping-bag"></i></div>
                <div class="user-menu-item-content">
                    <div class="user-menu-item-title">Мои заказы</div>
                    <div class="user-menu-item-desc">История покупок</div>
                </div>
                <i class="fas fa-chevron-right user-menu-item-arrow"></i>
            </a>
            <a href="/profile.html#balance" class="user-menu-item">
                <div class="user-menu-item-icon"><i class="fas fa-coins"></i></div>
                <div class="user-menu-item-content">
                    <div class="user-menu-item-title">Баланс</div>
                    <div class="user-menu-item-desc">Пополнение и история</div>
                </div>
                <i class="fas fa-chevron-right user-menu-item-arrow"></i>
            </a>
            ${isAdminUser ? `
                <a href="/admin.html" class="user-menu-item user-menu-item-admin">
                    <div class="user-menu-item-icon"><i class="fas fa-crown"></i></div>
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
                <i class="fas fa-sign-out-alt"></i> Выйти из аккаунта
            </button>
        </div>
    `;

    document.body.appendChild(menu);
    setTimeout(() => menu.classList.add('user-menu-visible'), 10);

    // Закрытие при клике вне меню
    const closeMenuHandler = (e) => {
        if (!menu.contains(e.target) && e.target !== authBtn && !authBtn?.contains(e.target)) {
            menu.classList.remove('user-menu-visible');
            setTimeout(() => menu.remove(), 300);
            document.removeEventListener('click', closeMenuHandler);
            document.removeEventListener('scroll', closeMenuOnScroll);
        }
    };
    
    // Закрытие при скролле
    const closeMenuOnScroll = () => {
        menu.classList.remove('user-menu-visible');
        setTimeout(() => menu.remove(), 300);
        document.removeEventListener('click', closeMenuHandler);
        document.removeEventListener('scroll', closeMenuOnScroll);
    };
    
    setTimeout(() => {
        document.addEventListener('click', closeMenuHandler);
        document.addEventListener('scroll', closeMenuOnScroll);
    }, 100);

    const escHandler = (e) => {
        if (e.key === 'Escape') {
            menu.classList.remove('user-menu-visible');
            setTimeout(() => menu.remove(), 300);
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

function generateAllBadgesHTML(badges) {
    let html = '';
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
    return authData.id === '992442453833547886';
}

// ========== ЗАГРУЗКА НОВОСТЕЙ ==========
async function loadLatestNews() {
    try {
        const response = await fetch('/api/news');
        const data = await response.json();
        if (!data?.success) return;

        const latest = data.news.slice(0, 3);
        const container = document.getElementById('latestNews');
        if (!container) return;

        container.innerHTML = latest.map(news => `
            <div class="news-card">
                <div class="news-content">
                    <div class="news-date">${news.date}</div>
                    <span class="news-tag">${news.category}</span>
                    <h3>${escapeHtml(news.title)}</h3>
                    <p style="color: #b9bbbe;">${escapeHtml(news.content.substring(0, 100))}...</p>
                    <a href="/news.html" style="color: #5865F2;">Читать далее →</a>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('❌ Ошибка загрузки новостей:', error);
    }
}

// ========== ЗАГРУЗКА ПОПУЛЯРНЫХ ТОВАРОВ ==========
async function loadPopularProducts() {
    try {
        const response = await fetch('/api/products');
        const data = await response.json();
        if (!data?.success) return;

        const popular = data.products.filter(p => p.popular).slice(0, 3);
        const container = document.getElementById('popularProducts');
        if (!container) return;

        if (popular.length === 0 && data.products.length > 0) {
            popular.push(...data.products.slice(0, 3));
        }

        container.innerHTML = popular.map(product => `
            <div class="product-card">
                <div class="product-image">
                    <img src="${product.image || product.icon || '/image/default-product.png'}" alt="${escapeHtml(product.name)}">
                </div>
                <div class="product-info">
                    <h3>${escapeHtml(product.name)}</h3>
                    <p>${escapeHtml(product.description || '')}</p>
                    <div class="product-price">${product.price} ₽</div>
                    <button class="btn-buy" onclick="buyProduct('${escapeHtml(product.id)}', '${escapeHtml(product.name)}', ${product.price})">
                        Купить
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('❌ Ошибка загрузки товаров:', error);
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

    window.api.getUser(authData.id)
        .then(data => {
            if (!data?.success || !data.user) throw new Error('Нет данных пользователя');
            
            const userBalance = data.user.balance || 0;
            const finalPrice = window.paymentSystem?.calculateDiscountedPrice(originalPrice, productId) || originalPrice;

            if (userBalance < finalPrice) {
                if (window.paymentSystem?.showInsufficientFundsModal) {
                    window.paymentSystem.showInsufficientFundsModal(finalPrice, userBalance, productName);
                } else {
                    alert(`Недостаточно средств: нужно ${finalPrice} ₽, у вас ${userBalance} ₽`);
                }
                return;
            }

            if (window.paymentSystem?.showPaymentModal) {
                window.paymentSystem.showPaymentModal(productName, originalPrice, productId);
            } else {
                alert('Система оплаты временно недоступна');
            }
        })
        .catch(error => {
            console.error('❌ Ошибка покупки:', error);
            alert('Ошибка: ' + error.message);
        });
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
        const btn = card.querySelector('.btn-buy');
        const productId = btn?.onclick?.toString().match(/'([^']+)'/)?.[1];
        const originalPrice = parseFloat(btn?.onclick?.toString().match(/, (\d+)/)?.[1]);
        
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

window.buyProduct = buyProduct;
window.showUserMenu = showUserMenu;
window.logout = logout;
window.isAdmin = isAdmin;
window.checkAuth = checkAuth;
window.updateHomePagePrices = updateHomePagePrices;