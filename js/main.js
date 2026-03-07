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

        authBtn.innerHTML = `
            <img src="https://cdn.discordapp.com/avatars/${authData.id}/${authData.avatar}.png?size=32" 
                 style="width: 32px; height: 32px; border-radius: 50%; margin-right: 8px;"
                 onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
            <span>${authData.username}</span>
            ${badges}
            <i class="fas fa-chevron-down" style="margin-left: 5px;"></i>
        `;
        authBtn.onclick = showUserMenu;
        
    } else if (authData.username && authData.verificationCode) {
        // Требуется верификация
        authBtn.innerHTML = '<i class="fas fa-hourglass-half"></i> Завершить регистрацию';
        authBtn.onclick = () => window.location.href = '/verify.html';
    } else {
        // Не авторизован
        authBtn.innerHTML = '<i class="fab fa-discord"></i> Войти';
        authBtn.onclick = () => window.location.href = '/auth.html';
    }
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

// ========== БЕЙДЖИ ==========

function getUserBadges(authData) {
    const badges = normalizeBadges(authData.badges);
    return badges.verified 
        ? '<img src="https://cdn3.emoji.gg/emojis/32765-verifiedtwitter.gif" style="width: 18px; height: 18px; margin-left: 6px;" title="Верифицированный аккаунт">'
        : '';
}

function normalizeBadges(badgesData) {
    if (!badgesData) return { verified: false, partner: false, buyer: false };
    if (typeof badgesData === 'string') return { verified: badgesData === 'verified', partner: false, buyer: false };
    if (typeof badgesData === 'object') {
        return {
            verified: !!badgesData.verified,
            partner: !!badgesData.partner,
            buyer: !!badgesData.buyer
        };
    }
    return { verified: false, partner: false, buyer: false };
}

// ========== ЗАГРУЗКА ТОВАРОВ ==========

async function loadPopularProducts() {
    try {
        const data = await window.api.getProducts();
        if (!data?.success) return;

        const popular = data.products.filter(p => p.popular).slice(0, 3);
        const container = document.getElementById('popularProducts');
        if (!container) return;

        container.innerHTML = popular.map(product => {
            let finalPrice = product.price;
            let discountHtml = '';

            if (window.paymentSystem) {
                finalPrice = window.paymentSystem.calculateDiscountedPrice(product.price, product.id);
                const discountInfo = window.paymentSystem.getDiscountInfo(product.price, product.id);
                if (discountInfo.discount > 0) {
                    discountHtml = `
                        <div style="margin-bottom: 0.5rem;">
                            <span style="text-decoration: line-through; color: #b9bbbe;">${product.price} ₽</span>
                            <span style="color: #57F287; font-weight: 600; margin-left: 10px;">${finalPrice} ₽</span>
                            <span style="background: #57F287; color: #1e1f29; padding: 2px 8px; border-radius: 12px; margin-left: 10px;">-${discountInfo.discount}%</span>
                        </div>
                    `;
                }
            }

            return `
                <div class="product-card">
                    <div class="product-image" style="background: linear-gradient(135deg, #5865F2, #4752c4);">
                        <i class="${product.icon || 'fas fa-box'}"></i>
                    </div>
                    <div class="product-info">
                        <h3 class="product-title">${product.name}</h3>
                        <p style="color: #b9bbbe; margin-bottom: 1rem;">${product.description}</p>
                        ${discountHtml || `<div class="product-price">${finalPrice} ₽</div>`}
                        <button class="btn-buy" onclick="buyProduct('${product.id}', '${product.name}', ${product.price})">
                            Купить сейчас
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('❌ Ошибка загрузки товаров:', error);
    }
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
