(function() {
    'use strict';

    // Глобальные переменные
    let products = [];
    let currentCategory = 'all';
    let currentUser = null;
    let isApiReady = false;

    // Инициализация при загрузке страницы
    document.addEventListener('DOMContentLoaded', async function() {
        console.log('🛍️ Shop page initializing...');

        // Ждем загрузки API
        await waitForApi();

        try {
            await Promise.all([
                loadUserData(),
                loadProducts('all'),
                initPromocodeSystem()
            ]);

            initCategories();
            updateAuthButton();
            addAnimationStyles();
            initMobileMenu();

            console.log('✅ Shop initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing shop:', error);
            showError('Ошибка инициализации магазина');
        }
    });

    // Ожидание загрузки API
    async function waitForApi(timeout = 5000) {
        const startTime = Date.now();
        while (!window.api && Date.now() - startTime < timeout) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!window.api) {
            console.error('❌ API not loaded within timeout');
            showError('Не удалось загрузить API. Обновите страницу.');
            return false;
        }
        isApiReady = true;
        console.log('✅ API is ready');
        return true;
    }

    // Загрузка данных пользователя через API
    async function loadUserData() {
        const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');

        if (authData.id && !authData.verificationCode && window.api) {
            try {
                const data = await window.api.getUser(authData.id);
                if (data?.success && data.user) {
                    currentUser = data.user;

                    // Обновляем localStorage
                    authData.balance = data.user.balance;
                    authData.badges = data.user.badges;
                    localStorage.setItem('bhstore_auth', JSON.stringify(authData));

                    console.log('✅ User data loaded:', currentUser);
                }
            } catch (error) {
                console.warn('⚠️ Failed to load user data:', error);
            }
        }
    }

    // Инициализация системы промокодов
    async function initPromocodeSystem() {
        for (let i = 0; i < 10; i++) {
            if (window.promocodeSystem) {
                console.log('✅ Promocode system loaded');
                enhancePromocodeSystem();

                if (typeof window.promocodeSystem.renderUI === 'function') {
                    window.promocodeSystem.renderUI();
                } else {
                    window.promocodeSystem.renderUI = updateShopActivePromocodes;
                    window.promocodeSystem.renderUI();
                }
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        console.warn('⚠️ Promocode system not loaded, creating fallback');
        createPromocodeFallback();
    }

    // Улучшение системы промокодов
    function enhancePromocodeSystem() {
        const ps = window.promocodeSystem;

        if (!ps.getDiscountedPrice) {
            ps.getDiscountedPrice = function(originalPrice, productId = null) {
                if (!this.activeDiscounts?.length) return originalPrice;

                const applicable = this.activeDiscounts.filter(d => !d.productId || d.productId === productId);
                if (!applicable.length) return originalPrice;

                const totalDiscount = Math.min(applicable.reduce((sum, d) => sum + (d.value || 0), 0), 90);
                return Math.round(originalPrice * (1 - totalDiscount / 100));
            };
        }

        if (!ps.getAppliedDiscounts) {
            ps.getAppliedDiscounts = function(productId = null) {
                if (!this.activeDiscounts) return [];
                return productId
                    ? this.activeDiscounts.filter(d => !d.productId || d.productId === productId)
                    : this.activeDiscounts;
            };
        }

        if (!ps.removeDiscount) {
            ps.removeDiscount = function(code) {
                this.activeDiscounts = this.activeDiscounts.filter(d => d.code !== code);
                this.saveToStorage?.();
                this.renderUI?.();
                loadProducts(currentCategory);
            };
        }

        if (!ps.saveToStorage) {
            ps.saveToStorage = function() {
                localStorage.setItem('bhstore_active_promocodes', JSON.stringify({
                    activeDiscounts: this.activeDiscounts || []
                }));
            };
        }

        if (!ps.loadFromStorage) {
            ps.loadFromStorage = function() {
                try {
                    const saved = localStorage.getItem('bhstore_active_promocodes');
                    this.activeDiscounts = saved ? (JSON.parse(saved).activeDiscounts || []) : [];
                } catch (e) {
                    console.error('Error loading promocodes:', e);
                    this.activeDiscounts = [];
                }
            };
        }

        ps.loadFromStorage?.();
    }

    // Fallback для промокодов
    function createPromocodeFallback() {
        window.promocodeSystem = {
            activeDiscounts: [],
            getDiscountedPrice(price) { return price; },
            getAppliedDiscounts() { return []; },
            removeDiscount(code) {
                this.activeDiscounts = this.activeDiscounts.filter(d => d.code !== code);
                this.saveToStorage();
                this.renderUI();
                loadProducts(currentCategory);
            },
            saveToStorage() {
                localStorage.setItem('bhstore_active_promocodes', JSON.stringify({
                    activeDiscounts: this.activeDiscounts
                }));
            },
            loadFromStorage() {
                try {
                    const saved = localStorage.getItem('bhstore_active_promocodes');
                    this.activeDiscounts = saved ? (JSON.parse(saved).activeDiscounts || []) : [];
                } catch (e) {
                    this.activeDiscounts = [];
                }
            },
            renderUI() {
                updateShopActivePromocodes();
            }
        };
        window.promocodeSystem.loadFromStorage();
        console.log('✅ Promocode fallback created');
    }

    // Инициализация категорий
    function initCategories() {
        const categoryButtons = document.querySelectorAll('.category-btn');

        categoryButtons.forEach(button => {
            button.addEventListener('click', function() {
                categoryButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                currentCategory = this.dataset.category;
                loadProducts(currentCategory);

                document.getElementById('productsContainer')?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            });
        });
    }

    // Загрузка товаров через API
    async function loadProducts(category) {
        const container = document.getElementById('productsContainer');
        if (!container) return;

        currentCategory = category;
        showLoading(container);

        try {
            if (!window.api) throw new Error('API not available');

            const data = await window.api.getProducts();

            if (!data?.success || !data.products?.length) {
                renderNoProducts(category, true);
                return;
            }

            products = data.products;

            const filtered = category === 'all'
                ? products
                : products.filter(p => p.category?.toLowerCase() === category.toLowerCase());

            if (filtered.length === 0) {
                renderNoProducts(category, false);
            } else {
                renderProducts(filtered);
            }

        } catch (error) {
            console.error('Error loading products:', error);
            showError('Не удалось загрузить товары');
        }
    }

    // Показать загрузку
    function showLoading(container) {
        container.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Загрузка товаров...</p>
            </div>
        `;
    }

    // Показать "нет товаров"
    function renderNoProducts(category, isApiEmpty = false) {
        const container = document.getElementById('productsContainer');
        if (!container) return;

        const categoryNames = {
            'all': 'магазине',
            'premium': 'премиум товаров',
            'discord': 'Discord',
            'discordbot': 'Discord бот',
            'services': 'услуг',
            'events': 'ивентов'
        };

        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <h3>Товары не найдены</h3>
                <p>${isApiEmpty
                    ? 'В базе данных пока нет товаров. Добавьте их через админ-панель.'
                    : `В категории "${categoryNames[category] || category}" пока нет товаров.`}</p>
                ${category !== 'all' ? `
                    <button onclick="window.loadProducts('all')" class="btn-primary">
                        <i class="fas fa-store"></i> Показать все товары
                    </button>
                ` : ''}
            </div>
        `;
    }

    // Отображение товаров
    function renderProducts(productsToRender) {
        const container = document.getElementById('productsContainer');
        if (!container) return;

        container.innerHTML = productsToRender.map((product, index) => {
            const discountInfo = getDiscountInfo(product.price, product.id);
            const finalPrice = discountInfo.finalPrice;
            const hasDiscount = discountInfo.discount > 0;

            return `
                <div class="product-card" style="animation-delay: ${index * 0.1}s">
                    ${hasDiscount ? `
                        <div class="product-discount-badge">
                            <i class="fas fa-tag"></i> -${discountInfo.discount}%
                        </div>
                    ` : ''}

                    <div class="product-image">
                        <img src="${product.image || product.icon || '/image/default-product.png'}"
                             alt="${escapeHtml(product.name)}"
                             onerror="this.src='/image/default-product.png'">
                    </div>

                    <div class="product-info">
                        <h3 class="product-title">${escapeHtml(product.name)}</h3>
                        <p class="product-description">${escapeHtml(product.description || '')}</p>

                        ${product.features ? `
                            <div class="product-features">
                                ${Array.isArray(product.features) ? product.features.map(feature => `
                                    <div class="feature-item">
                                        <i class="fas fa-check"></i>
                                        <span>${escapeHtml(feature)}</span>
                                    </div>
                                `).join('') : ''}
                            </div>
                        ` : ''}

                        <div class="price-section">
                            ${hasDiscount ? `
                                <div class="original-price">
                                    <span><i class="fas fa-clock"></i> Обычная цена</span>
                                    <span>${discountInfo.originalPrice} ₽</span>
                                </div>
                                <div class="final-price">
                                    <span><i class="fas fa-tag"></i> Цена со скидкой</span>
                                    <span>${finalPrice} ₽</span>
                                </div>
                            ` : `
                                <div class="final-price" style="justify-content: center;">
                                    <span>${finalPrice} ₽</span>
                                </div>
                            `}
                        </div>

                        ${discountInfo.appliedPromocodes.length > 0 ? `
                            <div class="applied-promocodes">
                                <div class="applied-promocodes-title">
                                    <i class="fas fa-ticket-alt"></i>
                                    Применены промокоды:
                                </div>
                                <div class="applied-promocodes-list">
                                    ${discountInfo.appliedPromocodes.map(p => `
                                        <span class="promocode-tag">
                                            <i class="fas fa-tag"></i> ${escapeHtml(p.code)}
                                        </span>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}

                        <button class="btn-buy"
                                onclick="buyProduct('${escapeHtml(product.id)}', '${escapeHtml(product.name)}', ${product.price})"
                                data-product-id="${escapeHtml(product.id)}">
                            <i class="fas fa-shopping-cart"></i>
                            Купить сейчас
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Получение информации о скидке
    function getDiscountInfo(originalPrice, productId = null) {
        if (!window.promocodeSystem) {
            return {
                originalPrice,
                finalPrice: originalPrice,
                discount: 0,
                discountAmount: 0,
                appliedPromocodes: []
            };
        }

        try {
            const finalPrice = window.promocodeSystem.getDiscountedPrice?.(originalPrice, productId) || originalPrice;
            const appliedPromocodes = window.promocodeSystem.getAppliedDiscounts?.(productId) || [];

            const totalDiscount = appliedPromocodes.reduce((sum, d) => sum + (d.value || 0), 0);
            const cappedDiscount = Math.min(totalDiscount, 90);
            const discountAmount = Math.round(originalPrice * (cappedDiscount / 100));

            return {
                originalPrice,
                finalPrice,
                discount: cappedDiscount,
                discountAmount,
                appliedPromocodes
            };
        } catch (error) {
            console.error('Error calculating discount:', error);
            return {
                originalPrice,
                finalPrice: originalPrice,
                discount: 0,
                discountAmount: 0,
                appliedPromocodes: []
            };
        }
    }

    // Покупка товара (использует API)
    window.buyProduct = async function(productId, productName, originalPrice) {
        console.log('Buying product:', { productId, productName, originalPrice });

        const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');

        if (!authData.id) {
            showNotification('Пожалуйста, авторизуйтесь для покупки', 'warning');
            setTimeout(() => window.location.href = '/auth.html', 2000);
            return;
        }

        if (authData.verificationCode) {
            showNotification('Завершите регистрацию', 'warning');
            setTimeout(() => window.location.href = '/verify.html', 2000);
            return;
        }

        try {
            if (!window.api) throw new Error('API not available');

            // Получаем актуальные данные пользователя
            const userData = await window.api.getUser(authData.id);
            if (!userData?.success || !userData.user) {
                throw new Error('Не удалось получить данные пользователя');
            }

            const userBalance = userData.user.balance || 0;
            const discountInfo = getDiscountInfo(originalPrice, productId);
            const finalPrice = discountInfo.finalPrice;

            if (userBalance < finalPrice) {
                showInsufficientFundsModal(finalPrice, userBalance, productName, productId);
                return;
            }

            showPurchaseConfirmation(productName, finalPrice, productId, userBalance, discountInfo);

        } catch (error) {
            console.error('Error buying product:', error);
            showNotification('Ошибка: ' + error.message, 'error');
        }
    };

    // Показать подтверждение покупки
    function showPurchaseConfirmation(productName, finalPrice, productId, userBalance, discountInfo) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'purchaseConfirmationModal';

        const orderId = 'BH-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Подтверждение покупки</h2>
                    <button class="modal-close" onclick="closePurchaseModal()">×</button>
                </div>

                <div class="purchase-details">
                    <div class="purchase-row">
                        <span class="purchase-label"><i class="fas fa-box"></i> Товар:</span>
                        <span class="purchase-value">${escapeHtml(productName)}</span>
                    </div>

                    ${discountInfo.discount > 0 ? `
                        <div class="purchase-row">
                            <span class="purchase-label"><i class="fas fa-tag"></i> Оригинальная цена:</span>
                            <span class="purchase-value" style="text-decoration: line-through;">${discountInfo.originalPrice} ₽</span>
                        </div>
                        <div class="purchase-row">
                            <span class="purchase-label"><i class="fas fa-percent"></i> Скидка (${discountInfo.discount}%):</span>
                            <span class="purchase-value highlight">-${discountInfo.discountAmount} ₽</span>
                        </div>
                    ` : ''}

                    <div class="purchase-row">
                        <span class="purchase-label"><i class="fas fa-credit-card"></i> Итоговая сумма:</span>
                        <span class="purchase-value highlight">${finalPrice} ₽</span>
                    </div>

                    <div class="purchase-row">
                        <span class="purchase-label"><i class="fas fa-wallet"></i> Ваш баланс:</span>
                        <span class="purchase-value ${userBalance >= finalPrice ? 'highlight' : 'warning'}">${userBalance} ₽</span>
                    </div>

                    <div class="purchase-row">
                        <span class="purchase-label"><i class="fas fa-chart-line"></i> Останется:</span>
                        <span class="purchase-value">${userBalance - finalPrice} ₽</span>
                    </div>

                    <div class="purchase-row">
                        <span class="purchase-label"><i class="fas fa-hashtag"></i> Номер заказа:</span>
                        <span class="purchase-value" style="color: var(--primary);">${orderId}</span>
                    </div>
                </div>

                <div class="modal-actions">
                    <button class="btn-primary" onclick="confirmPurchase('${orderId}', '${escapeHtml(productId)}', '${escapeHtml(productName)}', ${finalPrice}, ${discountInfo.originalPrice})">
                        <i class="fas fa-check"></i> Подтвердить
                    </button>
                    <button class="btn-secondary" onclick="closePurchaseModal()">
                        <i class="fas fa-times"></i> Отмена
                    </button>
                </div>

                <div class="info-message">
                    <i class="fas fa-info-circle"></i>
                    После подтверждения средства будут списаны с баланса
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    // Закрытие модального окна
    window.closePurchaseModal = function() {
        const modal = document.getElementById('purchaseConfirmationModal');
        if (modal) {
            modal.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => modal.remove(), 300);
        }
    };

    // Подтверждение покупки
    window.confirmPurchase = async function(orderId, productId, productName, finalPrice, originalPrice) {
        try {
            const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
            const discountInfo = getDiscountInfo(originalPrice, productId);

            const confirmBtn = document.querySelector('.btn-primary');
            if (confirmBtn) {
                confirmBtn.disabled = true;
                confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Обработка...';
            }

            showNotification('Обработка покупки...', 'info');

            const orderData = {
                userId: authData.id,
                productId,
                productName,
                price: finalPrice,
                originalPrice,
                username: authData.username
            };

            if (discountInfo.appliedPromocodes.length > 0) {
                orderData.promocodes = discountInfo.appliedPromocodes.map(p => p.code);
                orderData.discount = discountInfo.discount;
                orderData.discountAmount = discountInfo.discountAmount;
            }

            // Используем API для создания заказа
            const result = await window.api.createOrder(orderData);

            if (result?.success) {
                // Обновляем данные пользователя
                authData.balance = result.newBalance;
                if (!authData.badges) authData.badges = {};
                authData.badges.buyer = true;
                localStorage.setItem('bhstore_auth', JSON.stringify(authData));

                currentUser = authData;

                // Удаляем использованные промокоды
                if (discountInfo.appliedPromocodes.length > 0 && window.promocodeSystem) {
                    discountInfo.appliedPromocodes.forEach(p => {
                        window.promocodeSystem.removeDiscount?.(p.code);
                    });
                }

                closePurchaseModal();
                showSuccessMessage(result.orderId || orderId, productName, result.newBalance);

                updateAuthButton();
                window.promocodeSystem?.renderUI?.();

            } else {
                throw new Error(result?.error || 'Ошибка при создании заказа');
            }

        } catch (error) {
            console.error('Purchase error:', error);
            showNotification('Ошибка: ' + error.message, 'error');

            const confirmBtn = document.querySelector('.btn-primary');
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="fas fa-check"></i> Подтвердить';
            }
        }
    };

    // Показать успешное сообщение
    function showSuccessMessage(orderId, productName, newBalance) {
        const modal = document.createElement('div');
        modal.className = 'success-message';
        modal.innerHTML = `
            <div class="success-content">
                <div class="success-icon">
                    <i class="fas fa-check"></i>
                </div>
                <h2 class="success-title">Покупка успешна!</h2>
                <p>Заказ <strong>${escapeHtml(orderId)}</strong></p>
                <p>Товар: <strong>${escapeHtml(productName)}</strong></p>
                <div class="balance-info">
                    <p>Остаток на балансе:</p>
                    <p class="balance-amount">${newBalance} ₽</p>
                </div>
                <div class="modal-actions">
                    <button class="btn-primary" onclick="location.reload()">
                        <i class="fas fa-check"></i> Ок
                    </button>
                    <button class="btn-secondary" onclick="window.location.href='/profile.html#orders'">
                        <i class="fas fa-shopping-bag"></i> Мои заказы
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    // Показать окно недостаточно средств
    function showInsufficientFundsModal(price, balance, productName) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="insufficient-funds">
                    <div class="insufficient-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h2>Недостаточно средств</h2>
                    <p>Для покупки товара не хватает <span class="insufficient-amount">${price - balance} ₽</span></p>

                    <div class="purchase-details">
                        <div class="purchase-row">
                            <span>Стоимость товара:</span>
                            <span class="warning">${price} ₽</span>
                        </div>
                        <div class="purchase-row">
                            <span>Ваш баланс:</span>
                            <span class="warning">${balance} ₽</span>
                        </div>
                    </div>

                    <div class="modal-actions">
                        <button class="btn-primary" onclick="window.location.href='/profile.html#balance'">
                            <i class="fas fa-coins"></i> Пополнить баланс
                        </button>
                        <button class="btn-secondary" onclick="this.closest('.modal').remove()">
                            <i class="fas fa-times"></i> Закрыть
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    // Показать ошибку
    function showError(message) {
        const container = document.getElementById('productsContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${escapeHtml(message)}</p>
                <button class="btn-primary" onclick="location.reload()">
                    <i class="fas fa-sync-alt"></i> Попробовать снова
                </button>
            </div>
        `;
    }

    // Показать уведомление
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${escapeHtml(message)}</span>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Обновление активных промокодов в магазине
    function updateShopActivePromocodes() {
        const container = document.getElementById('shopActivePromocodes');
        const countEl = document.getElementById('promocodeCount');
        if (!container) return;

        const activePromos = window.promocodeSystem?.activeDiscounts || [];

        if (countEl) countEl.textContent = activePromos.length;

        if (activePromos.length > 0) {
            const globalDiscounts = activePromos.filter(p => !p.productId);
            const totalGlobalDiscount = Math.min(globalDiscounts.reduce((sum, d) => sum + (d.value || 0), 0), 90);

            container.innerHTML = activePromos.map(promo => `
                <div class="promocode-item">
                    <div class="promocode-info">
                        <div class="promocode-icon">
                            <i class="fas fa-ticket-alt"></i>
                        </div>
                        <div class="promocode-details">
                            <h4>${escapeHtml(promo.code)}</h4>
                            <p>
                                <i class="fas fa-percent"></i>
                                Скидка: ${promo.value}%
                                ${promo.productId ? ' (на конкретный товар)' : ' (на все товары)'}
                            </p>
                        </div>
                    </div>
                    <div class="promocode-value">
                        -${promo.value}%
                    </div>
                    <button class="btn-remove-promocode" onclick="removeShopPromocode('${escapeHtml(promo.code)}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('');

            if (totalGlobalDiscount > 0) {
                container.innerHTML += `
                    <div class="global-discount-info">
                        <i class="fas fa-info-circle"></i>
                        Общая скидка на все товары: <strong>${totalGlobalDiscount}%</strong>
                    </div>
                `;
            }
        } else {
            container.innerHTML = `
                <div class="empty-promocodes">
                    <i class="fas fa-ticket-alt"></i>
                    <p>Нет активных промокодов</p>
                    <small>Активируйте промокод в <a href="/profile.html">профиле</a></small>
                </div>
            `;
        }
    }

    // Удаление промокода
    window.removeShopPromocode = function(code) {
        window.promocodeSystem?.removeDiscount?.(code);
    };

    // Добавление стилей для анимаций
    function addAnimationStyles() {
        if (document.getElementById('shop-animation-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'shop-animation-styles';
        styles.textContent = `
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }

            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }

            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 16px 24px;
                background: var(--bg-card);
                border-left: 4px solid var(--primary);
                border-radius: 8px;
                box-shadow: var(--shadow-xl);
                z-index: 10003;
                display: flex;
                align-items: center;
                gap: 12px;
                animation: slideInRight 0.3s ease-out;
            }

            .notification.success { border-left-color: var(--accent); }
            .notification.error { border-left-color: #ED4245; }
            .notification.warning { border-left-color: #FEE75C; }

            .loading-spinner {
                grid-column: 1 / -1;
                text-align: center;
                padding: 60px;
                color: var(--text-secondary);
            }

            .spinner {
                width: 50px;
                height: 50px;
                border: 3px solid var(--border-light);
                border-top-color: var(--primary);
                border-radius: 50%;
                margin: 0 auto 20px;
                animation: spin 1s linear infinite;
            }

            .empty-state, .error-state {
                grid-column: 1 / -1;
                text-align: center;
                padding: 60px;
                color: var(--text-secondary);
                background: var(--bg-card);
                border-radius: var(--border-radius-lg);
                border: 1px solid var(--border-light);
            }

            .empty-state i, .error-state i {
                font-size: 4rem;
                color: var(--text-tertiary);
                margin-bottom: 20px;
                opacity: 0.5;
            }

            .empty-state h3 {
                color: var(--text-primary);
                margin-bottom: 10px;
            }

            .empty-state p {
                margin-bottom: 20px;
            }

            .error-state i {
                color: #ED4245;
                opacity: 1;
            }

            .global-discount-info {
                margin-top: 15px;
                padding: 12px;
                background: rgba(87, 242, 135, 0.1);
                border-radius: 8px;
                color: var(--accent);
                font-size: 0.95rem;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .info-message {
                margin-top: 20px;
                padding: 12px;
                background: var(--gray-50);
                border-radius: 8px;
                color: var(--text-tertiary);
                font-size: 0.9rem;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .balance-info {
                background: var(--gray-50);
                padding: 15px;
                border-radius: 8px;
                margin: 20px 0;
            }

            .balance-amount {
                font-size: 2rem;
                font-weight: 700;
                color: var(--accent);
                margin: 5px 0 0;
            }

            .product-image img {
                width: 100%;
                height: 200px;
                object-fit: cover;
                border-radius: var(--border-radius-lg);
            }
        `;

        document.head.appendChild(styles);
    }

    // Инициализация мобильного меню
    function initMobileMenu() {
        const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
        const navMenu = document.querySelector('.nav-menu');
        const navAuth = document.querySelector('.nav-auth');

        if (!mobileMenuBtn || !navMenu) return;

        let mobileNav = document.querySelector('.mobile-nav');
        if (!mobileNav) {
            mobileNav = document.createElement('div');
            mobileNav.className = 'mobile-nav';
            mobileNav.innerHTML = `
                <div class="mobile-nav-header">
                    <div class="mobile-nav-logo">
                        <img src="image/logo.png" alt="BHStore">
                        <span>BHStore</span>
                    </div>
                    <button class="mobile-nav-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="mobile-nav-menu"></div>
                <div class="mobile-nav-auth"></div>
            `;
            document.body.appendChild(mobileNav);
        }

        const mobileNavInstance = document.querySelector('.mobile-nav');
        const closeBtn = mobileNavInstance.querySelector('.mobile-nav-close');

        function updateMobileNav() {
            const menuDiv = mobileNavInstance.querySelector('.mobile-nav-menu');
            const authDiv = mobileNavInstance.querySelector('.mobile-nav-auth');
            if (menuDiv) menuDiv.innerHTML = navMenu.innerHTML;
            if (authDiv && navAuth) authDiv.innerHTML = navAuth.innerHTML;
        }

        mobileMenuBtn.addEventListener('click', () => {
            updateMobileNav();
            mobileNavInstance.classList.add('active');
            document.body.style.overflow = 'hidden';
        });

        closeBtn.addEventListener('click', () => {
            mobileNavInstance.classList.remove('active');
            document.body.style.overflow = '';
        });

        mobileNavInstance.addEventListener('click', (e) => {
            if (e.target === mobileNavInstance) {
                mobileNavInstance.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }

    // Обновление кнопки авторизации
    window.updateAuthButton = function() {
        const authBtn = document.getElementById('authBtn');
        if (!authBtn) return;

        const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');

        if (authData.id && !authData.verificationCode) {
            const avatarUrl = authData.avatar
                ? `https://cdn.discordapp.com/avatars/${authData.id}/${authData.avatar}.png?size=32`
                : 'https://cdn.discordapp.com/embed/avatars/0.png';

            authBtn.innerHTML = `
                <img src="${avatarUrl}"
                     class="auth-avatar"
                     alt="Avatar"
                     onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                <span>${escapeHtml(authData.username)}</span>
                <i class="fas fa-chevron-down"></i>
            `;
            authBtn.onclick = (e) => {
                e.stopPropagation();
                if (window.showUserMenu) {
                    window.showUserMenu(e);
                }
            };
        } else if (authData.id && authData.verificationCode) {
            authBtn.innerHTML = `
                <i class="fas fa-hourglass-half"></i>
                <span>Завершить регистрацию</span>
            `;
            authBtn.onclick = () => window.location.href = '/verify.html';
        } else {
            authBtn.innerHTML = '<i class="fab fa-discord"></i> Войти';
            authBtn.onclick = () => window.location.href = '/auth.html';
        }
    };

    // Вспомогательная функция экранирования HTML
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Экспорт функций в глобальную область
    window.loadProducts = loadProducts;
    window.getDiscountInfo = getDiscountInfo;
})();