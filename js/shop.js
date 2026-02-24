// shop.js - Полная оптимизированная версия (меню пользователя удалено)

(function() {
    // Глобальные переменные
    let products = [];
    let currentCategory = 'all';
    
    // Инициализация при загрузке страницы
    document.addEventListener('DOMContentLoaded', async function() {
        console.log('🛍️ Shop page initialized');
        
        try {
            // Инициализируем систему промокодов
            await initPromocodeSystem();
            
            // Инициализируем категории
            initCategories();
            
            // Загружаем товары
            await loadProducts('all');
            
            // Обновляем кнопку авторизации
            updateAuthButton();
            
            // Проверяем авторизацию
            if (typeof checkAuth === 'function') {
                checkAuth();
            }
            
            // Добавляем стили для анимаций
            addAnimationStyles();
            
            // Инициализируем мобильное меню
            initMobileMenu();
            
        } catch (error) {
            console.error('❌ Error initializing shop:', error);
            showError('Ошибка инициализации магазина');
        }
    });

    // Инициализация системы промокодов
    async function initPromocodeSystem() {
        for (let i = 0; i < 10; i++) {
            if (window.promocodeSystem) {
                console.log('✅ Promocode system loaded');
                enhancePromocodeSystem();
                
                if (typeof window.promocodeSystem.renderUI === 'function') {
                    window.promocodeSystem.renderUI();
                } else {
                    window.promocodeSystem.renderUI = function() {
                        updateShopActivePromocodes();
                    };
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
        
        if (typeof ps.getDiscountedPrice !== 'function') {
            ps.getDiscountedPrice = function(originalPrice, productId = null) {
                if (!this.activeDiscounts || this.activeDiscounts.length === 0) {
                    return originalPrice;
                }
                
                const applicableDiscounts = this.activeDiscounts.filter(discount => {
                    if (!discount.productId) return true;
                    return discount.productId === productId;
                });
                
                if (applicableDiscounts.length === 0) {
                    return originalPrice;
                }
                
                const totalDiscount = applicableDiscounts.reduce((sum, discount) => {
                    return Math.min(sum + (discount.value || 0), 90);
                }, 0);
                
                const discountAmount = originalPrice * (totalDiscount / 100);
                return Math.round(Math.max(originalPrice - discountAmount, 0));
            };
        }
        
        if (typeof ps.getAppliedDiscounts !== 'function') {
            ps.getAppliedDiscounts = function(productId = null) {
                if (!this.activeDiscounts) return [];
                
                if (productId) {
                    return this.activeDiscounts.filter(discount => 
                        !discount.productId || discount.productId === productId
                    );
                }
                
                return this.activeDiscounts;
            };
        }
        
        if (typeof ps.removeDiscount !== 'function') {
            ps.removeDiscount = function(code) {
                this.activeDiscounts = this.activeDiscounts.filter(d => d.code !== code);
                this.saveToStorage?.();
                this.renderUI?.();
                loadProducts(currentCategory);
            };
        }
        
        if (typeof ps.saveToStorage !== 'function') {
            ps.saveToStorage = function() {
                localStorage.setItem('bhstore_active_promocodes', JSON.stringify({
                    activeDiscounts: this.activeDiscounts || []
                }));
            };
        }
        
        if (typeof ps.loadFromStorage !== 'function') {
            ps.loadFromStorage = function() {
                try {
                    const saved = localStorage.getItem('bhstore_active_promocodes');
                    if (saved) {
                        const data = JSON.parse(saved);
                        this.activeDiscounts = data.activeDiscounts || [];
                    } else {
                        this.activeDiscounts = [];
                    }
                } catch (e) {
                    console.error('Error loading promocodes:', e);
                    this.activeDiscounts = [];
                }
            };
        }
        
        ps.loadFromStorage?.();
    }

    // Создание fallback для системы промокодов
    function createPromocodeFallback() {
        window.promocodeSystem = {
            activeDiscounts: [],
            
            getDiscountedPrice(originalPrice, productId = null) {
                return originalPrice;
            },
            
            getAppliedDiscounts(productId = null) {
                return [];
            },
            
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
                    if (saved) {
                        const data = JSON.parse(saved);
                        this.activeDiscounts = data.activeDiscounts || [];
                    }
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

    // Загрузка товаров
    async function loadProducts(category) {
        const container = document.getElementById('productsContainer');
        if (!container) return;
        
        currentCategory = category;
        
        showLoading(container);
        
        try {
            let productsData = await fetchProductsFromAPI();
            
            if (!productsData || productsData.length === 0) {
                productsData = getDemoProducts();
            }
            
            products = productsData;
            
            let filteredProducts = products;
            if (category !== 'all') {
                filteredProducts = products.filter(product => 
                    product.category?.toLowerCase() === category.toLowerCase()
                );
            }
            
            if (filteredProducts.length === 0) {
                renderNoProducts(category);
            } else {
                renderProducts(filteredProducts);
            }
            
        } catch (error) {
            console.error('Error loading products:', error);
            products = getDemoProducts();
            renderProducts(products.filter(p => 
                category === 'all' || p.category?.toLowerCase() === category.toLowerCase()
            ));
        }
    }

    // Загрузка товаров с API
    async function fetchProductsFromAPI() {
        try {
            const response = await fetch('/api/products', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data && data.success) {
                return data.products || [];
            }
            
            return [];
        } catch (error) {
            console.warn('API fetch failed, using demo data:', error);
            return [];
        }
    }

    function getDemoProducts() {
        return [
            // Ваши демо-товары
        ];
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

    // Отображение сообщения "нет товаров"
    function renderNoProducts(category) {
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
                <p>В категории "${categoryNames[category] || category}" пока нет товаров.</p>
                ${category !== 'all' ? `
                    <button onclick="window.retryLoadProducts('all')" class="btn-primary">
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
        
        if (!productsToRender || productsToRender.length === 0) {
            renderNoProducts(currentCategory);
            return;
        }
        
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
                        <img src="${product.icon}" style="width: 950px;">
                    </div>
                    
                    <div class="product-info">
                        <h3 class="product-title">${escapeHtml(product.name)}</h3>
                        <p class="product-description">${escapeHtml(product.icon2)} ${escapeHtml(product.description)}</p>
                        
                        ${product.features ? `
                            <div class="product-features">
                                ${product.features.map(feature => `
                                    <div class="feature-item">
                                        <i class="fas fa-check"></i>
                                        <span>${escapeHtml(feature)}</span>
                                    </div>
                                `).join('')}
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

    // Функция для экранирования HTML
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Добавление секции активных промокодов
    function addPromocodeDisplaySection() {
        const shopContainer = document.querySelector('.shop-container');
        if (!shopContainer || document.getElementById('shopActivePromocodesSection')) return;
        
        const section = document.createElement('div');
        section.id = 'shopActivePromocodesSection';
        section.className = 'active-promocodes-section';
        section.innerHTML = `
            <div class="active-promocodes-title">
                <i class="fas fa-ticket-alt"></i>
                <h3>Активные промокоды</h3>
                <span id="promocodeCount">0</span>
            </div>
            <div id="shopActivePromocodes" class="active-promocodes-list">
                <div class="empty-promocodes">
                    <i class="fas fa-ticket-alt"></i>
                    <p>Нет активных промокодов</p>
                    <small>Активируйте промокод в <a href="/profile.html">профиле</a></small>
                </div>
            </div>
        `;
        
        const shopTitle = shopContainer.querySelector('h1');
        if (shopTitle) {
            shopTitle.insertAdjacentElement('afterend', section);
        } else {
            shopContainer.prepend(section);
        }
    }

    // Обновление отображения активных промокодов
    function updateShopActivePromocodes() {
        if (!document.getElementById('shopActivePromocodesSection')) {
            addPromocodeDisplaySection();
        }
        
        const container = document.getElementById('shopActivePromocodes');
        const countEl = document.getElementById('promocodeCount');
        if (!container) return;
        
        const activePromos = window.promocodeSystem?.activeDiscounts || [];
        
        if (countEl) {
            countEl.textContent = activePromos.length;
        }
        
        if (activePromos.length > 0) {
            const globalDiscounts = activePromos.filter(p => !p.productId);
            const totalGlobalDiscount = Math.min(
                globalDiscounts.reduce((sum, d) => sum + (d.value || 0), 0), 
                90
            );
            
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
        if (window.promocodeSystem?.removeDiscount) {
            window.promocodeSystem.removeDiscount(code);
        }
    };

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

    // Покупка товара
    window.buyProduct = async function(productId, productName, originalPrice) {
        console.log('Buying product:', { productId, productName, originalPrice });
        
        const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        
        if (!authData.username) {
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
            const response = await fetch(`/api/user/${authData.id}`);
            const data = await response.json();
            
            if (!data.success || !data.user) {
                throw new Error('Не удалось получить данные пользователя');
            }
            
            const userBalance = data.user.balance || 0;
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

    // Показ уведомления
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

    // Показ окна подтверждения покупки
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
            
            const response = await fetch('/api/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                authData.balance = result.newBalance || (authData.balance - finalPrice);
                if (!authData.badges) authData.badges = {};
                authData.badges.buyer = true;
                
                localStorage.setItem('bhstore_auth', JSON.stringify(authData));
                
                if (discountInfo.appliedPromocodes.length > 0 && window.promocodeSystem) {
                    discountInfo.appliedPromocodes.forEach(p => {
                        window.promocodeSystem.removeDiscount?.(p.code);
                    });
                }
                
                closePurchaseModal();
                showSuccessMessage(result.orderId || orderId, productName, authData.balance);
                
                updateAuthButton();
                window.promocodeSystem?.renderUI?.();
                
            } else {
                throw new Error(result.error || 'Ошибка при создании заказа');
            }
            
        } catch (error) {
            console.error('Purchase error:', error);
            showNotification('Ошибка: ' + error.message, 'error');
        }
    };

    // Показ успешного сообщения
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

    // Показ окна недостаточно средств
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

    // Показ ошибки
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
        `;
        
        document.head.appendChild(styles);
    }

    // Инициализация мобильного меню
    function initMobileMenu() {
        const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
        const navMenu = document.querySelector('.nav-menu');
        const navAuth = document.querySelector('.nav-auth');
        
        if (!mobileMenuBtn || !navMenu) return;
        
        // Создаем мобильное меню если его нет
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
                <div class="mobile-nav-menu">
                    ${navMenu.innerHTML}
                </div>
                ${navAuth ? `
                    <div class="mobile-nav-auth">
                        ${navAuth.innerHTML}
                    </div>
                ` : ''}
            `;
            document.body.appendChild(mobileNav);
        }
        
        const mobileNavInstance = document.querySelector('.mobile-nav');
        const closeBtn = mobileNavInstance.querySelector('.mobile-nav-close');
        
        // Открытие меню
        mobileMenuBtn.addEventListener('click', () => {
            mobileNavInstance.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
        
        // Закрытие меню
        closeBtn.addEventListener('click', closeMobileMenu);
        
        // Закрытие при клике на ссылку
        mobileNavInstance.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', closeMobileMenu);
        });
        
        // Закрытие при клике вне меню
        mobileNavInstance.addEventListener('click', (e) => {
            if (e.target === mobileNavInstance) {
                closeMobileMenu();
            }
        });
        
        function closeMobileMenu() {
            mobileNavInstance.classList.remove('active');
            document.body.style.overflow = '';
        }
        
        // Обновляем содержимое мобильного меню при изменении кнопки авторизации
        const observer = new MutationObserver(() => {
            const mobileAuth = mobileNavInstance.querySelector('.mobile-nav-auth');
            if (mobileAuth && navAuth) {
                mobileAuth.innerHTML = navAuth.innerHTML;
            }
            
            const mobileMenu = mobileNavInstance.querySelector('.mobile-nav-menu');
            if (mobileMenu && navMenu) {
                mobileMenu.innerHTML = navMenu.innerHTML;
            }
        });
        
        observer.observe(navAuth, { childList: true, subtree: true, characterData: true });
        observer.observe(navMenu, { childList: true, subtree: true, characterData: true });
    }

    // Обновление кнопки авторизации
    window.updateAuthButton = function() {
        const authBtn = document.getElementById('authBtn');
        if (!authBtn) return;
        
        const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        
        if (authData.username && !authData.verificationCode) {
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
                // Здесь будет открытие меню из navig.js
                if (window.showUserMenu) {
                    window.showUserMenu(e);
                }
            };
        } else if (authData.username && authData.verificationCode) {
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

    // Экспортируем функции в глобальную область
    window.retryLoadProducts = loadProducts;
    window.getDiscountInfo = getDiscountInfo;

    // Обновляем функцию checkAuth
    if (typeof window.checkAuth === 'function') {
        const originalCheckAuth = window.checkAuth;
        window.checkAuth = function() {
            originalCheckAuth?.();
            
            const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
            if (!authData.username || authData.verificationCode) {
                const authMessage = document.createElement('div');
                authMessage.className = 'auth-message';
                authMessage.innerHTML = `
                    <p>
                        <i class="fas fa-info-circle"></i>
                        Для покупки товаров необходимо 
                        <a href="/auth.html" style="pointer-events: none; opacity: 0.5; cursor: not-allowed;">авторизоваться через Discord</a>
                    </p>
                `;
                
                const shopContainer = document.querySelector('.shop-container');
                if (shopContainer && !document.querySelector('.auth-message')) {
                    shopContainer.prepend(authMessage);
                }
            }
        };
    }

})();