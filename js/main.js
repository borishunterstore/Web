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

    // ... (функции checkAuth, loadUserData, updateBalance, render... оставляем без изменений) ...
    // Для экономии места я не дублирую их, они работают корректно. 
    // Ниже идут ИСПРАВЛЕННЫЕ функции загрузки новостей и товаров.

    async function loadLatestNews() {
        const container = document.getElementById('latestNews');
        if (!container) return;
        
        try {
            const response = await fetch('/api/news');
            const data = await response.json();
            
            let items = [];
            if (data?.success && data.news?.length) {
                items = data.news.slice(0, 3);
            } else {
                throw new Error('Нет данных');
            }
            
            container.innerHTML = items.map(item => {
                const imageUrl = item.image || '/image/default-news.jpg';
                return `
                    <div class="news-card" onclick="location.href='/news.html?id=${item.id}'" style="cursor: pointer;">
                        <div class="news-card-image">
                            <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='/image/logo.png'">
                        </div>
                        <div class="news-card-content">
                            <div class="news-card-meta">
                                <span class="news-card-date"><i class="far fa-calendar-alt"></i> ${escapeHtml(item.date)}</span>
                                <span class="news-card-tag">${escapeHtml(item.category || 'Новость')}</span>
                            </div>
                            <h3>${escapeHtml(item.title)}</h3>
                            <p>${escapeHtml((item.content || '').substring(0, 100))}...</p>
                            <span class="news-card-link">Читать далее <i class="fas fa-arrow-right"></i></span>
                        </div>
                    </div>
                `;
            }).join('');
            
        } catch (error) {
            console.warn('⚠️ API новостей недоступен, показываем заглушку');
            // ЗАГЛУШКА, ЧТОБЫ БЛОК НЕ БЫЛ ПУСТЫМ ЛОКАЛЬНО
            container.innerHTML = `
                <div class="news-card">
                    <div class="news-card-image" style="background:#1a1525; display:flex; align-items:center; justify-content:center;">
                        <i class="fas fa-newspaper" style="font-size:3rem; color:var(--text-dim);"></i>
                    </div>
                    <div class="news-card-content">
                        <div class="news-card-meta"><span class="news-card-date">Сегодня</span></div>
                        <h3>Добро пожаловать в BS</h3>
                        <p>Мы запустили наш магазин! (Локальный режим: подключите БД или запустите netlify dev).</p>
                    </div>
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
            
            if (!data?.success || !data.products?.length) throw new Error('Нет данных');
            
            let popular = data.products.filter(p => p.popular).slice(0, 3);
            if (!popular.length) popular = data.products.slice(0, 3);
            
            container.innerHTML = popular.map(product => `
                <div class="product-card">
                    <div class="product-media" style="height:180px; background:#1a1525; display:flex; align-items:center; justify-content:center;">
                        <img src="${product.image || product.icon || '/image/logo.png'}" alt="${escapeHtml(product.name)}" style="max-height:100px;">
                    </div>
                    <div class="product-body" style="padding:20px;">
                        <h3 style="font-family:var(--font-display); font-size:1.2rem; margin-bottom:8px;">${escapeHtml(product.name)}</h3>
                        <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:16px;">${escapeHtml(product.description || '')}</p>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto;">
                            <span style="color:var(--accent-500); font-weight:700; font-size:1.2rem;">${product.price} ₽</span>
                            <button class="btn btn-primary" style="padding:8px 16px; height:auto; font-size:0.9rem;" onclick="window.buyProduct('${product.id}', '${escapeHtml(product.name)}', ${product.price})">Купить</button>
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.warn('⚠️ API товаров недоступен, показываем заглушку');
            // ЗАГЛУШКА
            container.innerHTML = `
                <div class="product-card" style="padding:30px; text-align:center; grid-column: 1/-1;">
                    <i class="fas fa-box-open" style="font-size:3rem; color:var(--text-dim); margin-bottom:16px;"></i>
                    <h3 style="color:var(--text);">Товары загружаются</h3>
                    <p style="color:var(--text-muted);">Для отображения товаров запустите <code>netlify dev</code> или проверьте подключение к БД.</p>
                </div>
            `;
        }
    }

    function toggleMobileMenu() {
        const menu = document.querySelector('.nav-menu');
        if (menu) menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
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

    // (Остальные функции checkAuth и меню пользователя оставь из старого файла, они рабочие)
})();