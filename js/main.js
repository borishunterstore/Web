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
        
        // Мобильное меню (старая логика для совместимости, если mobile-nav.js не загружен)
        const mobileBtn = document.querySelector('.mobile-menu-btn');
        const mobileNav = document.getElementById('mobileNav');
        const mobileNavOverlay = document.getElementById('mobileNavOverlay');
        const mobileNavClose = document.querySelector('.mobile-nav-close');
        
        if (mobileBtn && mobileNav) {
            mobileBtn.addEventListener('click', () => {
                mobileNav.classList.add('active');
                if (mobileNavOverlay) mobileNavOverlay.classList.add('active');
                document.body.style.overflow = 'hidden';
            });
        }
        if (mobileNavClose && mobileNav) {
            mobileNavClose.addEventListener('click', () => {
                mobileNav.classList.remove('active');
                if (mobileNavOverlay) mobileNavOverlay.classList.remove('active');
                document.body.style.overflow = '';
            });
        }
        if (mobileNavOverlay && mobileNav) {
            mobileNavOverlay.addEventListener('click', () => {
                mobileNav.classList.remove('active');
                mobileNavOverlay.classList.remove('active');
                document.body.style.overflow = '';
            });
        }

        // Закрытие меню профиля
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
        } catch (error) {}
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
        } catch (error) {}
    }

    function renderAuthenticatedButton(authData, btn) {
        const avatarUrl = getAvatarUrl(authData.id, authData.avatar);
        const badges = normalizeBadges(authData.badges);
        const mainBadge = getMainBadgeHTML(badges);

        btn.innerHTML = `
            <div class="auth-button-content">
                <div class="auth-avatar-wrapper">
                    <img src="${avatarUrl}" class="auth-avatar-img" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                    ${mainBadge ? `<span class="auth-badge-icon">${mainBadge}</span>` : ''}
                </div>
                <span class="auth-username">${escapeHtml(authData.username)}</span>
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
            <div class="auth-button-content" style="color:var(--accent-500)">
                <i class="fas fa-hourglass-half"></i>
                <span style="font-weight:600">Завершить регистрацию</span>
                <span class="auth-verification-badge" style="background:var(--accent-500);color:#fff;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:0.7rem">!</span>
            </div>`;
        btn.classList.remove('auth-authenticated');
        btn.onclick = () => window.location.href = '/verify.html';
    }

    function renderLoginButton(btn) {
        btn.innerHTML = `
            <div class="auth-button-content">
                <i class="fab fa-discord"></i>
                <span>Войти</span>
            </div>`;
        btn.classList.remove('auth-authenticated');
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
            menu.style.top = `${btnRect.bottom + 8}px`;
            menu.style.left = `${btnRect.left + btnRect.width / 2}px`;
            menu.style.transform = 'translate(-50%, 0) scale(1)';
        } else {
            menu.style.top = '50%';
            menu.style.left = '50%';
            menu.style.transform = 'translate(-50%, -50%) scale(1)';
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
        if (isMobile) {
            menu.style.cssText = 'position:fixed;opacity:0;visibility:hidden;pointer-events:none;transition:all 0.3s;';
        }
        
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
                <a href="/admin.html" class="user-menu-item" style="background:rgba(229,148,37,0.05);border:1px solid rgba(229,148,37,0.15)">
                    <div class="user-menu-item-icon" style="background:rgba(229,148,37,0.12);color:var(--accent-500)"><i class="fas fa-crown"></i></div>
                    <div class="user-menu-item-content"><div class="user-menu-item-title">Админ панель</div><div class="user-menu-item-desc">Управление магазином</div></div>
                    <span class="user-menu-item-badge" style="background:var(--accent-500);color:#fff;font-size:0.6rem;padding:2px 8px;border-radius:99px;margin-left:auto;text-transform:uppercase;font-weight:700">Admin</span>
                </a>` : ''}
            </div>
            <div class="user-menu-footer">
                <button onclick="localStorage.removeItem('bhstore_auth');window.location.href='/'" class="user-menu-logout-btn"><i class="fas fa-sign-out-alt"></i> Выйти</button>
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
    // ЗАГРУЗКА ТОВАРОВ И НОВОСТЕЙ
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
                    <div class="empty-state" style="grid-column:1/-1">
                        <i class="fas fa-newspaper"></i>
                        <h3>Новостей пока нет</h3>
                        <p>Скоро здесь появятся обновления.</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = items.map(item => {
                const imageUrl = item.image || '/image/logo.png';
                return `
                    <div class="news-card" onclick="location.href='/news.html?id=${item.id}'" style="cursor: pointer;">
                        <div class="news-card-image" style="height:180px;background:#1a1525;">
                            <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='/image/logo.png'" style="width:100%;height:100%;object-fit:cover">
                        </div>
                        <div class="news-card-content" style="padding:20px;">
                            <div style="font-size:0.75rem;color:var(--accent-400);margin-bottom:8px;">
                                <i class="far fa-calendar-alt"></i> ${escapeHtml(item.date)}
                            </div>
                            <h3 style="font-size:1.1rem;margin-bottom:10px;line-height:1.3;">${escapeHtml(item.title)}</h3>
                            <p style="color:var(--text-muted); font-size:0.85rem;line-height:1.5">${escapeHtml((item.content || '').substring(0, 80))}...</p>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Ошибка загрузки</h3>
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
            
            if (!data?.success || !data.products?.length) throw new Error('Нет товаров');
            
            let popular = data.products.filter(p => p.popular).slice(0, 3);
            if (!popular.length) popular = data.products.slice(0, 3);
            
            container.innerHTML = popular.map(product => `
                <div class="product-card" style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:20px; padding:0; overflow:hidden; display:flex; flex-direction:column;">
                    <div style="height:180px; background:#1a1525; display:flex; align-items:center; justify-content:center;">
                        <img src="${product.image || product.icon || '/image/logo.png'}" alt="${escapeHtml(product.name)}" style="max-height:120px; max-width:90%; object-fit:contain;">
                    </div>
                    <div style="padding:24px; display:flex; flex-direction:column; flex:1;">
                        <h3 style="font-family:var(--font-display); font-size:1.25rem; color:white; margin-bottom:8px;">${escapeHtml(product.name)}</h3>
                        <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:16px; flex:1;">${escapeHtml(product.description || 'Описание отсутствует')}</p>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto; padding-top:16px; border-top:1px solid var(--border);">
                            <span style="color:var(--accent-500); font-weight:700; font-size:1.1rem;">${product.price} ₽</span>
                            <a href="/shop.html" class="btn btn-primary" style="padding:8px 16px; height:auto; font-size:0.85rem; border-radius:8px;">Подробнее</a>
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1">
                    <i class="fas fa-box-open"></i>
                    <h3>Товары скоро появятся</h3>
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
        if (typeof badgesData === 'string') return { ...defaultBadges, [badgesData]: true };
        if (typeof badgesData === 'object') return { ...defaultBadges, ...badgesData };
        return defaultBadges;
    }

    function getAuthData() {
        try { return JSON.parse(localStorage.getItem('bhstore_auth') || '{}'); } catch { return {}; }
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
        try { return await window.api?.isAdmin() || false; } catch { return false; }
    }

    window.checkAuth = checkAuth;
    window.showUserMenu = showUserMenu;
    window.isAdmin = isAdmin;
    window.logout = () => { localStorage.removeItem('bhstore_auth'); window.location.reload(); };
    window.buyProduct = (id, name, price) => {
        const auth = getAuthData();
        if (!auth.username) { alert('Авторизуйтесь'); window.location.href = '/auth.html'; return; }
        if (auth.verificationCode) { alert('Завершите регистрацию'); window.location.href = '/verify.html'; return; }
        window.location.href = `/shop.html?product=${encodeURIComponent(id)}`;
    };
})();