(function() {
    'use strict';
    
    let refreshInterval = null;
    let isInitialized = false;

    const BADGE_CONFIG = {
        admin: { name: 'Администратор', image: '/image/BADGE/admin.gif', priority: 1 },
        verified: { name: 'Верифицированный', image: '/image/BADGE/verified.gif', priority: 2 },
        partner: { name: 'Партнёр', image: '/image/BADGE/partner.gif', priority: 3 },
        buyer: { name: 'Покупатель', image: '/image/BADGE/buy.gif', priority: 4 },
        early: { name: 'Ранний сторонник', image: '/image/BADGE/early.png', priority: 5 },
        vip: { name: 'VIP', image: '/image/BADGE/vip.png', priority: 6 }
    };

    document.addEventListener('DOMContentLoaded', async () => {
        if (isInitialized) return;
        isInitialized = true;
        
        await checkAuth();
        
        if (document.getElementById('popularProducts')) loadPopularProducts();
        if (document.getElementById('latestNews')) loadLatestNews();
        
        const mobileBtn = document.querySelector('.mobile-menu-btn');
        if (mobileBtn) mobileBtn.addEventListener('click', toggleMobileMenu);
        
        document.addEventListener('click', (e) => {
            const menu = document.querySelector('.user-menu');
            const btn = document.getElementById('authBtn');
            if (menu && !menu.contains(e.target) && e.target !== btn && !btn?.contains(e.target)) {
                menu.classList.remove('user-menu-visible');
                setTimeout(() => menu.remove(), 300);
            }
        });
        
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(() => checkAuth(), 30000);
    });

    // ==========================================
    // АВТОРИЗАЦИЯ И МЕНЮ ПОЛЬЗОВАТЕЛЯ
    // ==========================================
    async function checkAuth() {
        const authData = getAuthData();
        const authBtn = document.getElementById('authBtn');
        if (!authBtn) return;

        if (authData.token && !authData.username) {
            await loadUserData(authData);
        }

        if (authData.username && !authData.verificationCode) {
            await updateBalance(authData);
            renderAuthenticatedButton(authData, authBtn);
        } else if (authData.username && authData.verificationCode) {
            renderVerificationButton(authBtn);
        } else {
            renderLoginButton(authBtn);
        }
    }

    async function loadUserData(authData) {
        try {
            const response = await fetch('/api/user/me', {
                headers: { 'Authorization': `Bearer ${authData.token}` }
            });
            const data = await response.json();
            if (data.success && data.user) {
                Object.assign(authData, {
                    id: data.user.discordId,
                    username: data.user.username,
                    avatar: data.user.avatar,
                    balance: data.user.balance,
                    badges: data.user.badges || {}
                });
                saveAuthData(authData);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки:', error);
        }
    }

    async function updateBalance(authData) {
        try {
            const response = await fetch(`/api/user/${authData.id}/balance`, {
                headers: { 'Authorization': `Bearer ${authData.token}` }
            });
            const data = await response.json();
            if (data.success && data.balance !== undefined) {
                authData.balance = data.balance;
                saveAuthData(authData);
            }
        } catch (error) {
            console.error('❌ Ошибка баланса:', error);
        }
    }

    function renderAuthenticatedButton(authData, btn) {
        const avatarUrl = getAvatarUrl(authData.id, authData.avatar);
        const badges = normalizeBadges(authData.badges);
        const mainBadge = getMainBadgeHTML(badges);
        const badgesHtml = getUserBadgesHTML(badges);

        btn.innerHTML = `
            <div class="auth-button-content">
                <div class="auth-avatar-wrapper">
                    <img src="${avatarUrl}" class="auth-avatar-img" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
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
        
        btn.classList.add('auth-authenticated');
        btn.onclick = (e) => { e.stopPropagation(); showUserMenu(e); };
    }

    function renderVerificationButton(btn) {
        btn.innerHTML = `
            <div class="auth-button-content">
                <div class="auth-verification-icon"><i class="fas fa-hourglass-half"></i></div>
                <span class="auth-verification-text">Завершить регистрацию</span>
                <span class="auth-verification-badge">!</span>
            </div>`;
        btn.classList.add('auth-verification');
        btn.onclick = () => window.location.href = '/verify.html';
    }

    function renderLoginButton(btn) {
        btn.innerHTML = `
            <div class="auth-button-content">
                <div class="auth-discord-icon"><i class="fa-solid fa-network-wired"></i></div>
                <span class="auth-login-text">Войти</span>
                <span class="auth-login-hint">нажмите для входа</span>
            </div>`;
        btn.classList.remove('auth-authenticated', 'auth-verification');
        btn.onclick = () => window.location.href = '/auth.html';
    }

    async function showUserMenu(event) {
        event?.stopPropagation();
        const authData = getAuthData();
        if (!authData.id) return;

        await updateBalance(authData);
        
        const existingMenu = document.querySelector('.user-menu');
        if (existingMenu) existingMenu.remove();

        const authBtn = document.getElementById('authBtn');
        if (!authBtn) return;

        const btnRect = authBtn.getBoundingClientRect();
        const isMobile = window.innerWidth <= 768;
        const badges = normalizeBadges(authData.badges);
        const isAdminUser = await isAdmin();

        const menu = createMenuHTML(authData, badges, isAdminUser, isMobile);
        
        if (!isMobile) {
            menu.style.position = 'fixed';
            menu.style.top = `${btnRect.bottom + 5}px`;
            menu.style.left = `${btnRect.left + btnRect.width / 2}px`;
            menu.style.transform = 'translateX(-50%)';
        }
        
        document.body.appendChild(menu);
        setTimeout(() => menu.classList.add('user-menu-visible'), 10);

        setupMenuCloseListeners(menu, authBtn);
    }

    function createMenuHTML(authData, badges, isAdminUser, isMobile) {
        const avatarUrl = getAvatarUrl(authData.id, authData.avatar, 128);
        const mainBadge = getMainBadgeHTML(badges);
        const allBadges = generateAllBadgesHTML(badges);
        
        const menu = document.createElement('div');
        menu.className = 'user-menu';
        if (isMobile) menu.classList.add('user-menu-mobile');
        
        menu.innerHTML = `
            <div class="user-menu-header">
                <div class="user-menu-avatar-wrapper">
                    <img src="${avatarUrl}" class="user-menu-avatar" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                    ${mainBadge ? `<div class="user-menu-avatar-badge">${mainBadge}</div>` : ''}
                </div>
                <div class="user-menu-user-info">
                    <div class="user-menu-username">${escapeHtml(authData.username)}</div>
                    <div class="user-menu-user-id">ID: ${authData.id}</div>
                    <div class="user-menu-badges-container">${allBadges}</div>
                </div>
                <button class="user-menu-close" onclick="this.closest('.user-menu').remove()"><i class="fas fa-times"></i></button>
            </div>
            <div class="user-menu-balance">
                <div class="user-menu-balance-label"><i class="fas fa-wallet"></i> Баланс</div>
                <div class="user-menu-balance-amount">${authData.balance || 0} ₽</div>
            </div>
            <div class="user-menu-nav">
                <a href="/profile.html" class="user-menu-item">
                    <div class="user-menu-item-icon"><i class="fas fa-user"></i></div>
                    <div class="user-menu-item-content"><div class="user-menu-item-title">Профиль</div><div class="user-menu-item-desc">Ваша личная информация</div></div>
                    <i class="fas fa-chevron-right user-menu-item-arrow"></i>
                </a>
                <a href="/profile.html#orders" class="user-menu-item">
                    <div class="user-menu-item-icon"><i class="fas fa-shopping-bag"></i></div>
                    <div class="user-menu-item-content"><div class="user-menu-item-title">Мои заказы</div><div class="user-menu-item-desc">История покупок</div></div>
                    <i class="fas fa-chevron-right user-menu-item-arrow"></i>
                </a>
                ${isAdminUser ? `
                <a href="/admin.html" class="user-menu-item user-menu-item-admin">
                    <div class="user-menu-item-icon"><i class="fas fa-crown"></i></div>
                    <div class="user-menu-item-content"><div class="user-menu-item-title">Админ панель</div><div class="user-menu-item-desc">Управление магазином</div></div>
                    <span class="user-menu-item-badge">Admin</span>
                </a>
                ` : ''}
            </div>
            <div class="user-menu-footer">
                <button onclick="logout()" class="user-menu-logout-btn"><i class="fas fa-sign-out-alt"></i> Выйти</button>
            </div>
        `;
        
        return menu;
    }

    function setupMenuCloseListeners(menu, authBtn) {
        const closeHandler = (e) => {
            if (!menu.contains(e.target) && e.target !== authBtn && !authBtn?.contains(e.target)) {
                menu.classList.remove('user-menu-visible');
                setTimeout(() => menu.remove(), 300);
                document.removeEventListener('click', closeHandler);
                document.removeEventListener('scroll', scrollHandler);
            }
        };
        
        const scrollHandler = () => {
            menu.classList.remove('user-menu-visible');
            setTimeout(() => menu.remove(), 300);
            document.removeEventListener('click', closeHandler);
            document.removeEventListener('scroll', scrollHandler);
        };
        
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                menu.classList.remove('user-menu-visible');
                setTimeout(() => menu.remove(), 300);
                document.removeEventListener('keydown', escHandler);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeHandler);
            document.addEventListener('scroll', scrollHandler);
            document.addEventListener('keydown', escHandler);
        }, 100);
    }

    // ==========================================
    // ЗАГРУЗКА ТОВАРОВ И НОВОСТЕЙ (С ЗАГЛУШКАМИ)
    // ==========================================
    async function loadLatestNews() {
        const container = document.getElementById('latestNews');
        if (!container) return;
        
        try {
            const response = await fetch('/api/news');
            const data = await response.json();
            
            let items = [];
            if (data?.success && data.news?.length) {
                items = data.news.slice(0, 3);
            }
            
            if (items.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-newspaper"></i>
                        <h3>Новостей пока нет</h3>
                        <p>Скоро здесь появятся последние обновления магазина.</p>
                        <a href="/news.html" class="btn btn-ghost" style="margin-top:20px;">Все новости <i class="fas fa-arrow-right"></i></a>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = items.map(item => {
                const imageUrl = item.image || '/image/logo.png';
                return `
                    <div class="news-card" onclick="location.href='/news.html?id=${item.id}'" style="cursor: pointer;">
                        <div class="news-card-image" style="height:180px;">
                            <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='/image/logo.png'">
                        </div>
                        <div class="news-card-content">
                            <div class="news-card-meta">
                                <span class="news-card-date"><i class="far fa-calendar-alt"></i> ${escapeHtml(item.date)}</span>
                            </div>
                            <h3 style="font-size:1.1rem; margin-bottom:10px;">${escapeHtml(item.title)}</h3>
                            <p style="color:var(--text-muted); font-size:0.85rem;">${escapeHtml((item.content || '').substring(0, 80))}...</p>
                        </div>
                    </div>
                `;
            }).join('');
            
        } catch (error) {
            console.warn('⚠️ API новостей недоступен');
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle" style="color:var(--danger-500)"></i>
                    <h3>Ошибка загрузки</h3>
                    <p>Не удалось подключиться к серверу новостей.</p>
                </div>
            `;
        }
    }

    async function loadPopularProducts() {
        const container = document.getElementById('popularProducts');
        if (!container) return;
        
        try {
            const response = await fetch('/api/products');
            const data = await response.json();
            
            if (!data?.success || !data.products?.length) {
                throw new Error('Нет товаров');
            }
            
            let popular = data.products.filter(p => p.popular).slice(0, 3);
            if (!popular.length) popular = data.products.slice(0, 3);
            
            container.innerHTML = popular.map(product => `
                <div class="product-card" style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:16px; padding:20px; display:flex; flex-direction:column;">
                    <div style="height:120px; display:flex; align-items:center; justify-content:center; margin-bottom:16px;">
                        <img src="${product.image || product.icon || '/image/logo.png'}" alt="${escapeHtml(product.name)}" style="max-height:100px; max-width:100%; object-fit:contain;">
                    </div>
                    <h3 style="font-family:var(--font-display); font-size:1.2rem; color:var(--text); margin-bottom:8px;">${escapeHtml(product.name)}</h3>
                    <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:20px; flex:1;">${escapeHtml(product.description || 'Описание отсутствует')}</p>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:var(--accent-500); font-weight:700; font-size:1.2rem;">${product.price} ₽</span>
                        <a href="/shop.html" class="btn btn-primary" style="padding:8px 16px; height:auto; font-size:0.85rem;">Подробнее</a>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.warn('⚠️ API товаров недоступен');
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-box-open"></i>
                    <h3>Товары скоро появятся</h3>
                    <p>Мы обновляем каталог. Зайдите чуть позже!</p>
                    <a href="/shop.html" class="btn btn-ghost" style="margin-top:20px;">В магазин <i class="fas fa-arrow-right"></i></a>
                </div>
            `;
        }
    }

    // ==========================================
    // УТИЛИТЫ
    // ==========================================
    function getAvatarUrl(userId, avatar, size = 64) {
        if (!avatar) return 'https://cdn.discordapp.com/embed/avatars/0.png';
        const ext = avatar.startsWith('a_') ? 'gif' : 'png';
        return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${ext}?size=${size}`;
    }

    function getMainBadgeHTML(badges) {
        const sorted = Object.entries(badges)
            .filter(([k, v]) => v && BADGE_CONFIG[k])
            .sort((a, b) => BADGE_CONFIG[a[0]].priority - BADGE_CONFIG[b[0]].priority);
        if (!sorted.length) return '';
        const config = BADGE_CONFIG[sorted[0][0]];
        return `<img src="${config.image}" alt="${config.name}" style="width:20px;height:20px;border-radius:50%">`;
    }

    function getUserBadgesHTML(badges) {
        return Object.entries(badges)
            .filter(([k, v]) => v && BADGE_CONFIG[k])
            .sort((a, b) => BADGE_CONFIG[a[0]].priority - BADGE_CONFIG[b[0]].priority)
            .map(([k]) => `<img src="${BADGE_CONFIG[k].image}" alt="${BADGE_CONFIG[k].name}" style="width:16px;height:16px">`)
            .join('');
    }

    function generateAllBadgesHTML(badges) {
        return Object.entries(badges)
            .filter(([k, v]) => v && BADGE_CONFIG[k])
            .sort((a, b) => BADGE_CONFIG[a[0]].priority - BADGE_CONFIG[b[0]].priority)
            .map(([k]) => {
                const c = BADGE_CONFIG[k];
                return `<div class="user-menu-badge"><img src="${c.image}" alt="${c.name}" style="width:14px;height:14px"><span>${c.name}</span></div>`;
            })
            .join('');
    }

    function normalizeBadges(badgesData) {
        const defaultBadges = { admin: false, verified: false, partner: false, buyer: false, early: false, vip: false };
        if (!badgesData) return defaultBadges;
        if (typeof badgesData === 'string') {
            return { ...defaultBadges, [badgesData]: true };
        }
        if (typeof badgesData === 'object') {
            return { ...defaultBadges, ...badgesData };
        }
        return defaultBadges;
    }

    function getAuthData() {
        try {
            return JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        } catch {
            return {};
        }
    }

    function saveAuthData(data) {
        localStorage.setItem('bhstore_auth', JSON.stringify(data));
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, (m) => {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    async function isAdmin() {
        const authData = getAuthData();
        if (authData.id === '992442453833547886') return true;
        try {
            return await window.api?.isAdmin() || false;
        } catch {
            return false;
        }
    }

    function toggleMobileMenu() {
        const menu = document.querySelector('.nav-menu');
        if (menu) menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
    }

    // Экспорт глобальных функций
    window.checkAuth = checkAuth;
    window.showUserMenu = showUserMenu;
    window.isAdmin = isAdmin;
    window.logout = () => {
        localStorage.removeItem('bhstore_auth');
        window.location.reload();
    };
    window.buyProduct = (id, name, price) => {
        const auth = getAuthData();
        if (!auth.username) {
            alert('Пожалуйста, авторизуйтесь');
            window.location.href = '/auth.html';
            return;
        }
        if (auth.verificationCode) {
            alert('Завершите регистрацию');
            window.location.href = '/verify.html';
            return;
        }
        window.location.href = `/shop.html?product=${encodeURIComponent(id)}`;
    };
    window.updateHomePagePrices = () => {};
})();