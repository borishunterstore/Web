// Основной JS файл
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация
    console.log('BHStore loaded');
    
    // Проверка авторизации и загрузка актуальных данных с сервера
    checkAuth().then(() => {
        // После проверки авторизации загружаем остальные данные
        if (document.getElementById('popularProducts')) {
            loadPopularProducts();
        }
        
        if (document.getElementById('latestNews')) {
            loadLatestNews();
        }
    });
    
    // Мобильное меню
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    }
    
    // Инициализация системы промокодов если есть
    if (typeof promocodeSystem !== 'undefined') {
        setTimeout(() => {
            if (promocodeSystem && typeof promocodeSystem.updateActivePromocodesUI === 'function') {
                promocodeSystem.updateActivePromocodesUI();
            }
        }, 1000);
    }
});

async function checkAuth() {
    const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
    const authBtn = document.getElementById('authBtn');
    
    if (!authBtn) return;
    
    // Если есть токен, но нет данных пользователя - пытаемся получить с сервера
    if (authData.token && authData.id) {
        try {
            // Получаем актуальные данные пользователя с сервера
            const response = await fetch(`/.netlify/functions/server/api/user/${authData.id}`);
            const data = await response.json();
            
            if (data.success && data.user) {
                // Обновляем локальные данные с сервера
                authData.username = data.user.username;
                authData.avatar = data.user.avatar;
                authData.balance = data.user.balance;
                authData.badges = data.user.badges;
                authData.discordId = data.user.discordId;
                authData.registeredAt = data.user.registeredAt;
                
                // Сохраняем обновленные данные
                localStorage.setItem('bhstore_auth', JSON.stringify(authData));
            }
        } catch (error) {
            console.error('Ошибка загрузки данных пользователя:', error);
        }
    }
    
    if (authData.username && !authData.verificationCode) {
        // Получаем бейджи пользователя
        const badges = getUserBadges(authData);
        
        // Загружаем баланс с сервера (еще раз, для уверенности)
        try {
            const balanceResponse = await fetch(`/.netlify/functions/server/api/user/${authData.id}/balance`);
            const balanceData = await balanceResponse.json();
            if (balanceData.success) {
                authData.balance = balanceData.balance;
                localStorage.setItem('bhstore_auth', JSON.stringify(authData));
            }
        } catch (error) {
            console.error('Ошибка загрузки баланса:', error);
        }
        
        // Пользователь авторизован
        authBtn.innerHTML = `
            <img src="https://cdn.discordapp.com/avatars/${authData.id}/${authData.avatar}.png?size=32" 
                 style="width: 32px; height: 32px; border-radius: 50%; margin-right: 8px;"
                 onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
            <span style="vertical-align: middle;">${authData.username}</span>
            ${badges}
            <i class="fas fa-chevron-down" style="margin-left: 8px; vertical-align: middle;"></i>
        `;
        authBtn.onclick = showUserMenu;
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
        authBtn.innerHTML = '<i class="fab fa-discord"></i> Войти';
        authBtn.onclick = () => {
            window.location.href = '/auth.html';
        };
    }
}

// Показ меню пользователя
async function showUserMenu() {
    const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
    
    // Получаем свежие данные с сервера перед показом меню
    try {
        const response = await fetch(`/.netlify/functions/server/api/user/${authData.id}`);
        const data = await response.json();
        
        if (data.success && data.user) {
            authData.balance = data.user.balance;
            authData.badges = data.user.badges;
            localStorage.setItem('bhstore_auth', JSON.stringify(authData));
        }
    } catch (error) {
        console.error('Ошибка загрузки данных для меню:', error);
    }
    
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
    const normalizedBadges = normalizeBadges(authData.badges);
    
    // Генерируем HTML для бейджей
    const badgesHtml = generateBadgesHTML(normalizedBadges);
    
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
        ${await isAdmin() ? `
            <a href="/admin.html" style="display: flex; align-items: center; gap: 10px; padding: 0.75rem; color: #5865F2; text-decoration: none; border-radius: 4px; transition: background 0.3s;">
                <i class="fas fa-crown" style="width: 20px;"></i>
                <span>Админ панель</span>
            </a>
        ` : ''}
        <hr style="border-color: #40444b; margin: 0.5rem 0;">
        <button onclick="logout()" style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 0.75rem; background: none; border: none; color: #ED4245; text-align: left; cursor: pointer; border-radius: 4px; transition: background 0.3s;">
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

// Проверка админ-прав
async function isAdmin() {
    const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
    
    // Проверяем админ-права через API
    if (authData.token) {
        try {
            const response = await fetch('/.netlify/functions/server/api/admin/users', {
                headers: {
                    'Authorization': `Bearer ${authData.token}`
                }
            });
            return response.status !== 403;
        } catch (error) {
            console.error('Ошибка проверки админ-прав:', error);
        }
    }
    
    return authData.discordId === '830087428214751284';
}

// Получение бейджей пользователя (для кнопки)
function getUserBadges(authData) {
    let badges = '';
    
    // Нормализуем бейджи
    const userBadges = normalizeBadges(authData.badges);
    
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

// Нормализация бейджей
function normalizeBadges(badgesData) {
    if (!badgesData) {
        return {
            verified: false,
            partner: false,
            buyer: false
        };
    }
    
    if (typeof badgesData === 'string') {
        if (badgesData === 'verified') {
            return { verified: true, partner: false, buyer: false };
        }
        return { verified: false, partner: false, buyer: false };
    }
    
    if (typeof badgesData === 'object') {
        return {
            verified: !!badgesData.verified,
            partner: !!badgesData.partner,
            buyer: !!badgesData.buyer
        };
    }
    
    return {
        verified: false,
        partner: false,
        buyer: false
    };
}

// Генерация HTML для бейджей в меню
function generateBadgesHTML(badges) {
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
                <img src="https://cdn3.emoji.gg/emojis/101291-partner-ids.png" style="width: 12px; height: 12px;">
                <span>Партнёр</span>
            </span>
        `);
    }
    
    // Покупатель
    if (badges.buyer) {
        badgesArray.push(`
            <span style="background: #57F287; color: #1e1f29; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; display: inline-flex; align-items: center; gap: 3px;">
                <img src="https://cdn3.emoji.gg/emojis/76595-money-mouth.gif" style="width: 12px; height: 12px;">
                <span>Покупатель</span>
            </span>
        `);
    }
    
    return badgesArray.join(' ');
}

function logout() {
    localStorage.removeItem('bhstore_auth');
    localStorage.removeItem('bhstore_orders');
    localStorage.removeItem('bhstore_promocode');
    localStorage.removeItem('bhstore_active_promocodes');
    window.location.reload();
}

async function loadPopularProducts() {
    try {
        const response = await fetch('/.netlify/functions/server/api/products');
        const data = await response.json();
        
        if (data.success) {
            const popularProducts = data.products.filter(p => p.popular).slice(0, 3);
            const container = document.getElementById('popularProducts');
            
            container.innerHTML = popularProducts.map(product => {
                // Рассчитываем итоговую цену с учетом промокодов
                let finalPrice = product.price;
                let discountHtml = '';
                
                if (window.paymentSystem) {
                    finalPrice = window.paymentSystem.calculateDiscountedPrice(product.price, product.id);
                    const discountInfo = window.paymentSystem.getDiscountInfo(product.price, product.id);
                    
                    if (discountInfo.discount > 0) {
                        discountHtml = `
                            <div style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 10px;">
                                <span style="color: #b9bbbe; text-decoration: line-through; font-size: 0.9rem;">
                                    ${product.price} ₽
                                </span>
                                <span style="color: #57F287; font-weight: 600;">
                                    ${finalPrice} ₽
                                </span>
                                <span style="background: #57F287; color: #1e1f29; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">
                                    -${discountInfo.discount}%
                                </span>
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
                            ${discountHtml}
                            <div class="product-price">${finalPrice} ₽</div>
                            <button class="btn-buy" onclick="buyProduct('${product.id}', '${product.name}', ${product.price})">
                                Купить сейчас
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

async function loadLatestNews() {
    try {
        const response = await fetch('/.netlify/functions/server/api/news');
        const data = await response.json();
        
        if (data.success) {
            const latestNews = data.news.slice(0, 3);
            const container = document.getElementById('latestNews');
            
            container.innerHTML = latestNews.map(news => `
                <div class="news-card">
                    <div class="news-content">
                        <div class="news-date">${news.date}</div>
                        <span class="news-tag">${news.category}</span>
                        <img src="${news.image}" style="margin: auto; width: 350px; object-fit: cover; border-radius: 10%;">
                        <h3>${news.title}</h3>
                        <p style="color: #b9bbbe;">${news.content}</p>
                        <a href="/news.html" style="color: #5865F2; text-decoration: none; font-weight: 500;">
                            Читать далее →
                        </a>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading news:', error);
    }
}

function buyProduct(productId, productName, originalPrice) {
    const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
    
    // Проверка авторизации
    if (!authData.username) {
        alert('Пожалуйста, авторизуйтесь для покупки товаров');
        window.location.href = '/auth.html';
        return;
    }
    
    // Если есть verificationCode, пользователь не завершил регистрацию
    if (authData.verificationCode) {
        alert('Пожалуйста, завершите регистрацию, введя код верификации');
        window.location.href = '/verify.html';
        return;
    }
    
    // Проверяем баланс через API
    fetch(`/.netlify/functions/server/api/user/${authData.id}`)
        .then(response => response.json())
        .then(data => {
            if (!data.success || !data.user) {
                throw new Error('Не удалось получить данные пользователя');
            }
            
            const userBalance = data.user.balance || 0;
            
            // Рассчитываем итоговую цену с учетом промокодов
            let finalPrice = originalPrice;
            if (window.paymentSystem) {
                finalPrice = window.paymentSystem.calculateDiscountedPrice(originalPrice, productId);
            }
            
            // Если баланса недостаточно, показываем окно пополнения
            if (userBalance < finalPrice) {
                if (window.paymentSystem) {
                    window.paymentSystem.showInsufficientFundsModal(finalPrice, userBalance, productName);
                } else {
                    alert(`Недостаточно средств! Нужно: ${finalPrice} ₽, у вас: ${userBalance} ₽`);
                }
                return;
            }
            
            // Используем новую систему оплаты
            if (typeof paymentSystem !== 'undefined') {
                paymentSystem.showPaymentModal(productName, originalPrice, productId);
            } else {
                // Загрузка payment.js если еще не загружен
                const script = document.createElement('script');
                script.src = '/js/payment.js';
                script.onload = () => {
                    if (window.paymentSystem) {
                        window.paymentSystem.showPaymentModal(productName, originalPrice, productId);
                    }
                };
                document.head.appendChild(script);
            }
        })
        .catch(error => {
            console.error('Error buying product:', error);
            alert('Ошибка: ' + error.message);
        });
}

async function createOrder(productId, productName, price) {
    try {
        const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        
        const response = await fetch('/.netlify/functions/server/api/create-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: authData.id,
                productId: productId,
                productName: productName,
                amount: price,
                username: authData.username
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Получаем свежий баланс с сервера
            const balanceResponse = await fetch(`/.netlify/functions/server/api/user/${authData.id}/balance`);
            const balanceData = await balanceResponse.json();
            
            if (balanceData.success) {
                authData.balance = balanceData.balance;
                localStorage.setItem('bhstore_auth', JSON.stringify(authData));
            }
            
            // Обновляем UI
            checkAuth();
            
            // Показываем успешное сообщение
            if (window.paymentSystem) {
                window.paymentSystem.showSuccessMessage(data.orderId, productName, authData.balance);
            } else {
                alert(`Заказ #${data.orderId} создан успешно!`);
                if (data.redirectUrl) {
                    window.location.href = data.redirectUrl;
                }
            }
        } else {
            alert('Ошибка при создании заказа: ' + data.error);
        }
    } catch (error) {
        console.error('Order error:', error);
        alert('Ошибка при создании заказа');
    }
}

function toggleMobileMenu() {
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) {
        navMenu.style.display = navMenu.style.display === 'flex' ? 'none' : 'flex';
    }
}

// Функция для обновления цен на главной странице
function updateHomePagePrices() {
    document.querySelectorAll('#popularProducts .product-card').forEach(card => {
        const productId = card.querySelector('.btn-buy')?.dataset.productId;
        const originalPrice = parseFloat(card.querySelector('.btn-buy')?.dataset.price);
        
        if (productId && originalPrice && window.paymentSystem) {
            const finalPrice = window.paymentSystem.calculateDiscountedPrice(originalPrice, productId);
            const discountInfo = window.paymentSystem.getDiscountInfo(originalPrice, productId);
            
            const priceElement = card.querySelector('.product-price');
            if (priceElement) {
                if (discountInfo.discount > 0) {
                    priceElement.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="color: #b9bbbe; text-decoration: line-through; font-size: 0.9rem;">
                                ${originalPrice} ₽
                            </span>
                            <span style="color: #57F287; font-weight: 600; font-size: 1.1rem;">
                                ${finalPrice} ₽
                            </span>
                            <span style="background: #57F287; color: #1e1f29; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">
                                -${discountInfo.discount}%
                            </span>
                        </div>
                    `;
                } else {
                    priceElement.textContent = `${finalPrice} ₽`;
                }
            }
        }
    });
}

// Обновляем цены при изменении активных промокодов
if (window.promocodeSystem) {
    const originalUpdateActivePromocodesUI = promocodeSystem.updateActivePromocodesUI;
    
    promocodeSystem.updateActivePromocodesUI = function() {
        if (originalUpdateActivePromocodesUI) {
            originalUpdateActivePromocodesUI.call(this);
        }
        updateHomePagePrices();
    };
}

// Глобальные функции для вызова из HTML
window.showUserMenu = showUserMenu;
window.logout = logout;
window.buyProduct = buyProduct;
window.isAdmin = isAdmin;