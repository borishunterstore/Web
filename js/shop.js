(function() {
    'use strict';

    let allProducts = [];
    let currentCategory = 'all';
    let currentProduct = null;

    // Конфигурация категорий
    const CATEGORY_CONFIG = {
        'montaz': { name: 'Монтаж видео', api: 'youtube', filter: p => p.name?.toLowerCase().includes('монтаж') || p.name?.toLowerCase().includes('видео') || p.category === 'youtube' },
        'ava': { name: 'Аватарки', api: 'avatar', filter: p => p.name?.toLowerCase().includes('аватар') || p.category === 'avatar' },
        'preview': { name: 'Превью', api: 'preview', filter: p => p.name?.toLowerCase().includes('превью') || p.category === 'preview' },
        'discord': { name: 'Discord услуги', api: 'discord', filter: p => p.name?.toLowerCase().includes('discord') || p.category === 'discord' || p.category === 'discordbot' },
        'tgbot': { name: 'Telegram боты', api: 'telegram', filter: p => p.name?.toLowerCase().includes('telegram') || p.name?.toLowerCase().includes('tg') || p.category === 'telegram' },
        'website': { name: 'Сайты', api: 'website', filter: p => p.name?.toLowerCase().includes('сайт') || p.name?.toLowerCase().includes('website') || p.category === 'website' },
        'minecraft': { name: 'Minecraft', api: 'minecraft', filter: p => p.name?.toLowerCase().includes('minecraft') || p.name?.toLowerCase().includes('майнкрафт') || p.category === 'minecraft' }
    };

    // Инициализация при загрузке страницы
    document.addEventListener('DOMContentLoaded', async function() {
        console.log('🛒 Shop page initializing...');
        
        await loadProducts();
        initCategories();
        initURLHandling();
        initPromocodeUI();
        
        console.log('✅ Shop page initialized');
    });

    // Загрузка товаров из API
    async function loadProducts() {
        const container = document.getElementById('productsContainer');
        if (!container) return;
        
        showLoading(container);
        
        try {
            const response = await fetch('/api/products');
            const data = await response.json();
            
            if (data.success && data.products && data.products.length > 0) {
                allProducts = data.products;
                console.log(`📦 Loaded ${allProducts.length} products`);
                
                const urlParams = new URLSearchParams(window.location.search);
                const categoryParam = urlParams.get('category');
                const productParam = urlParams.get('product');
                
                if (productParam) {
                    const product = allProducts.find(p => p.id === productParam);
                    if (product) {
                        showProductModal(product);
                        currentCategory = 'all';
                        renderProducts(allProducts);
                        activateCategoryButton('all');
                    } else {
                        renderProducts(allProducts);
                    }
                } else if (categoryParam && CATEGORY_CONFIG[categoryParam]) {
                    const filtered = filterProductsByCategory(categoryParam);
                    renderProducts(filtered);
                    activateCategoryButton(categoryParam);
                    currentCategory = categoryParam;
                } else {
                    renderProducts(allProducts);
                    activateCategoryButton('all');
                }
            } else {
                console.error('No products received from API');
                renderEmptyState('Товары не найдены', 'В магазине пока нет товаров. Зайдите позже.');
            }
        } catch (error) {
            console.error('❌ Error loading products:', error);
            renderErrorState('Не удалось загрузить товары', error.message);
        }
    }

    // Фильтрация товаров по категории
    function filterProductsByCategory(category) {
        if (category === 'all') return allProducts;
        
        const config = CATEGORY_CONFIG[category];
        if (!config) return [];
        
        return allProducts.filter(config.filter);
    }

    // Отображение товаров
    function renderProducts(productsToRender) {
        const container = document.getElementById('productsContainer');
        if (!container) return;
    
        container.innerHTML = productsToRender.map((product, index) => {
            const discountInfo = getDiscountInfo(product.price, product.id);
            const finalPrice = discountInfo.finalPrice;
            const hasDiscount = discountInfo.discount > 0;
            
            const safeProductId = escapeHtml(product.id);
            const safeProductName = escapeHtml(product.name);
            const safePrice = product.price;
            
            let descriptionHtml = product.description || '';
            const hasHtmlTags = /<[^>]*>/.test(descriptionHtml);
            const descriptionDisplay = hasHtmlTags ? descriptionHtml : escapeHtml(descriptionHtml);
    
            return `
                <div class="product-card" data-product-id="${safeProductId}" style="animation-delay: ${index * 0.1}s">
                    ${hasDiscount ? `
                        <div class="product-discount-badge">
                            <i class="fas fa-tag"></i> -${discountInfo.discount}%
                        </div>
                    ` : ''}
    
                    <div class="product-image">
                        <img src="${product.image || product.icon || '/image/default-product.png'}"
                             alt="${safeProductName}"
                             onerror="this.src='/image/default-product.png'">
                    </div>
    
                    <div class="product-info">
                        <h3 class="product-title">${safeProductName}</h3>
                        <div class="product-description">${descriptionDisplay}</div>
    
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
    
                        <div style="display: flex; gap: 10px; margin-top: 10px;">
                            <button class="btn-buy" onclick="window.buyProduct('${safeProductId}', '${safeProductName}', ${safePrice})">
                                <i class="fas fa-shopping-cart"></i> Купить
                            </button>
                            <button class="btn-details" onclick="window.showProductDetails('${safeProductId}')">
                                <i class="fas fa-info-circle"></i> Подробнее
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Обновляем URL после рендера
        updateURL();
    }

    // Показ деталей товара в модальном окне
    window.showProductDetails = function(productId) {
        const product = allProducts.find(p => p.id === productId);
        if (!product) {
            showToast('Товар не найден', 'error');
            return;
        }
        
        showProductModal(product);
        
        // Обновляем URL без перезагрузки
        const url = new URL(window.location.href);
        url.searchParams.set('product', productId);
        window.history.pushState({}, '', url);
    };
    
    function showProductModal(product) {
        const modal = document.getElementById('productModal');
        const modalTitle = document.getElementById('modalProductTitle');
        const modalContent = document.getElementById('modalProductContent');
        
        if (!modal || !modalContent) return;
        
        const discountInfo = getDiscountInfo(product.price, product.id);
        const finalPrice = discountInfo.finalPrice;
        const hasDiscount = discountInfo.discount > 0;
        
        modalTitle.textContent = product.name;
        
        let descriptionHtml = product.description || '';
        const hasHtmlTags = /<[^>]*>/.test(descriptionHtml);
        const descriptionDisplay = hasHtmlTags ? descriptionHtml : escapeHtml(descriptionHtml);
        
        modalContent.innerHTML = `
            <div class="product-detail">
                <div class="product-detail-image">
                    <img src="${product.image || product.icon || '/image/default-product.png'}" 
                         alt="${escapeHtml(product.name)}"
                         onerror="this.src='/image/default-product.png'">
                </div>
                
                <div class="product-detail-info">
                    <div class="product-detail-description">
                        <h3><i class="fas fa-align-left"></i> Описание</h3>
                        <div>${descriptionDisplay}</div>
                    </div>
                    
                    ${product.features && product.features.length > 0 ? `
                        <div class="product-detail-features">
                            <h3><i class="fas fa-list-check"></i> Что входит в услугу:</h3>
                            <ul>
                                ${product.features.map(f => `<li><i class="fas fa-check-circle"></i> ${escapeHtml(f)}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    <div class="product-detail-price">
                        ${hasDiscount ? `
                            <div class="price-row">
                                <span>Оригинальная цена:</span>
                                <span class="old-price">${product.price} ₽</span>
                            </div>
                            <div class="price-row">
                                <span>Скидка:</span>
                                <span class="discount-badge">-${discountInfo.discount}%</span>
                            </div>
                        ` : ''}
                        <div class="price-row final">
                            <span>Итоговая цена:</span>
                            <span class="final-price">${finalPrice} ₽</span>
                        </div>
                    </div>
                    
                    <button class="btn-buy btn-buy-large" onclick="window.buyProduct('${escapeHtml(product.id)}', '${escapeHtml(product.name)}', ${product.price}); window.closeProductModal();">
                        <i class="fas fa-shopping-cart"></i> Купить сейчас
                    </button>
                </div>
            </div>
        `;
        
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    
    window.closeProductModal = function() {
        const modal = document.getElementById('productModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
            
            const url = new URL(window.location.href);
            if (url.searchParams.has('product')) {
                url.searchParams.delete('product');
                window.history.pushState({}, '', url);
            }
        }
    };
    
    document.addEventListener('click', function(e) {
        const modal = document.getElementById('productModal');
        if (modal && modal.style.display === 'flex') {
            if (e.target === modal) {
                window.closeProductModal();
            }
        }
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            window.closeProductModal();
        }
    });

    // Инициализация категорий
    function initCategories() {
        const categoryBtns = document.querySelectorAll('.category-btn');
        
        categoryBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const category = this.dataset.category;
                currentCategory = category;
                
                const filtered = filterProductsByCategory(category);
                renderProducts(filtered);
                activateCategoryButton(category);
                
                // Обновляем URL
                updateURL();
                
                document.getElementById('productsContainer')?.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            });
        });
    }
    
    function activateCategoryButton(category) {
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === category);
        });
    }
    
    function initURLHandling() {
        window.addEventListener('popstate', function() {
            const urlParams = new URLSearchParams(window.location.search);
            const categoryParam = urlParams.get('category');
            const productParam = urlParams.get('product');
            
            if (productParam) {
                const product = allProducts.find(p => p.id === productParam);
                if (product) showProductModal(product);
            } else if (categoryParam && CATEGORY_CONFIG[categoryParam]) {
                const filtered = filterProductsByCategory(categoryParam);
                renderProducts(filtered);
                activateCategoryButton(categoryParam);
                currentCategory = categoryParam;
            } else {
                renderProducts(allProducts);
                activateCategoryButton('all');
                currentCategory = 'all';
            }
        });
    }
    
    function updateURL() {
        const url = new URL(window.location.href);
        if (currentCategory !== 'all') {
            url.searchParams.set('category', currentCategory);
        } else {
            url.searchParams.delete('category');
        }
        if (!url.searchParams.has('product')) {
            window.history.replaceState({}, '', url);
        }
    }
    
    // Получение информации о скидке
    function getDiscountInfo(originalPrice, productId = null) {
        if (!window.promocodeSystem || !window.promocodeSystem.activeDiscounts?.length) {
            return {
                originalPrice,
                finalPrice: originalPrice,
                discount: 0,
                discountAmount: 0,
                appliedPromocodes: []
            };
        }
        
        try {
            const applicablePromocodes = window.promocodeSystem.activeDiscounts.filter(promo => {
                if (!promo.product_ids || promo.product_ids.length === 0) return true;
                return promo.product_ids.includes(productId);
            });
            
            if (applicablePromocodes.length === 0) {
                return {
                    originalPrice,
                    finalPrice: originalPrice,
                    discount: 0,
                    discountAmount: 0,
                    appliedPromocodes: []
                };
            }
            
            const totalDiscount = Math.min(
                applicablePromocodes.reduce((sum, d) => sum + (d.value || 0), 0),
                90
            );
            const finalPrice = Math.round(originalPrice * (100 - totalDiscount) / 100);
            const discountAmount = originalPrice - finalPrice;
            
            return {
                originalPrice,
                finalPrice,
                discount: totalDiscount,
                discountAmount,
                appliedPromocodes: applicablePromocodes
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
    
    function initPromocodeUI() {
        const promocodeSection = document.getElementById('promocodeSection');
        if (!promocodeSection) return;
        
        const checkPromocodes = setInterval(() => {
            if (window.promocodeSystem?.activeDiscounts?.length > 0) {
                promocodeSection.style.display = 'block';
                updateActivePromocodesUI();
                clearInterval(checkPromocodes);
            }
        }, 500);
        
        window.updateProductsDisplay = function() {
            const filtered = filterProductsByCategory(currentCategory);
            renderProducts(filtered);
            updateActivePromocodesUI();
        };
    }
    
    function updateActivePromocodesUI() {
        const container = document.getElementById('shopActivePromocodes');
        const countEl = document.getElementById('promocodeCount');
        
        if (!container) return;
        
        const activePromos = window.promocodeSystem?.activeDiscounts || [];
        
        if (countEl) countEl.textContent = activePromos.length;
        
        if (activePromos.length > 0) {
            container.innerHTML = activePromos.map(promo => `
                <div class="promocode-item">
                    <div class="promocode-info">
                        <div class="promocode-icon">
                            <i class="fas fa-ticket-alt"></i>
                        </div>
                        <div class="promocode-details">
                            <h4>${escapeHtml(promo.code)}</h4>
                            <p><i class="fas fa-percent"></i> Скидка: ${promo.value}%</p>
                            ${promo.expires_at ? `
                                <p class="promocode-expires" style="font-size: 0.7rem; color: #FEE75C;">
                                    <i class="fas fa-clock"></i> Действует до: ${new Date(promo.expires_at).toLocaleDateString('ru-RU')}
                                </p>
                            ` : ''}
                        </div>
                    </div>
                    <div class="promocode-value">-${promo.value}%</div>
                    <button class="btn-remove-promocode" onclick="window.removeShopPromocode('${escapeHtml(promo.code)}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('');
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
    
    window.removeShopPromocode = function(code) {
        window.promocodeSystem?.removeDiscount?.(code);
        setTimeout(() => {
            const filtered = filterProductsByCategory(currentCategory);
            renderProducts(filtered);
            updateActivePromocodesUI();
        }, 100);
    };
    
    // Функция покупки (глобальная)
    window.buyProduct = async function(productId, productName, originalPrice) {
        console.log('🛒 Buying product:', { productId, productName, originalPrice });
        
        const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        
        if (!authData.id) {
            showToast('Пожалуйста, авторизуйтесь для покупки', 'warning');
            setTimeout(() => window.location.href = '/auth.html', 2000);
            return;
        }
        
        if (authData.verificationCode) {
            showToast('Завершите регистрацию', 'warning');
            setTimeout(() => window.location.href = '/verify.html', 2000);
            return;
        }
        
        try {
            const userData = await window.api?.getUser(authData.id);
            const userBalance = userData?.user?.balance || 0;
            const discountInfo = getDiscountInfo(originalPrice, productId);
            const finalPrice = discountInfo.finalPrice;
            
            if (userBalance < finalPrice) {
                showInsufficientFundsModal(finalPrice, userBalance, productName);
                return;
            }
            
            showPurchaseConfirmation(productName, finalPrice, productId, userBalance, discountInfo);
            
        } catch (error) {
            console.error('Error buying product:', error);
            showToast('Ошибка: ' + error.message, 'error');
        }
    };
    
    function showPurchaseConfirmation(productName, finalPrice, productId, userBalance, discountInfo) {
        const orderId = 'BH-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        
        const modalHtml = `
            <div class="modal" id="purchaseModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2><i class="fas fa-shopping-cart"></i> Подтверждение покупки</h2>
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
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
    
    window.closePurchaseModal = function() {
        const modal = document.getElementById('purchaseModal');
        if (modal) modal.remove();
    };
    
    window.confirmPurchase = async function(orderId, productId, productName, finalPrice, originalPrice) {
        const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        const discountInfo = getDiscountInfo(originalPrice, productId);
        
        try {
            showToast('Обработка покупки...', 'info');
            
            const orderData = {
                userId: authData.id,
                productId,
                productName,
                price: finalPrice,
                originalPrice,
                username: authData.username,
                orderId: orderId
            };
            
            if (discountInfo.appliedPromocodes.length > 0) {
                orderData.promocodes = discountInfo.appliedPromocodes.map(p => p.code);
                orderData.discount = discountInfo.discount;
                orderData.discountAmount = discountInfo.discountAmount;
            }
            
            const result = await window.api?.createOrder(orderData);
            
            if (result?.success) {
                authData.balance = result.newBalance;
                if (!authData.badges) authData.badges = {};
                authData.badges.buyer = true;
                localStorage.setItem('bhstore_auth', JSON.stringify(authData));
                
                if (discountInfo.appliedPromocodes.length > 0 && window.promocodeSystem) {
                    discountInfo.appliedPromocodes.forEach(p => {
                        window.promocodeSystem.removeDiscount?.(p.code);
                    });
                }
                
                closePurchaseModal();
                showSuccessMessage(result.orderId || orderId, productName, result.newBalance);
                
                if (window.checkAuth) window.checkAuth();
                
                setTimeout(() => {
                    const filtered = filterProductsByCategory(currentCategory);
                    renderProducts(filtered);
                    updateActivePromocodesUI();
                }, 500);
                
            } else {
                throw new Error(result?.error || 'Ошибка при создании заказа');
            }
            
        } catch (error) {
            console.error('Purchase error:', error);
            showToast('Ошибка: ' + error.message, 'error');
        }
    };
    
    function showSuccessMessage(orderId, productName, newBalance) {
        const modalHtml = `
            <div class="modal" id="successModal">
                <div class="modal-content" style="text-align: center;">
                    <div class="success-icon" style="width: 70px; height: 70px; background: #57F287; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                        <i class="fas fa-check" style="color: #1e1f29; font-size: 2rem;"></i>
                    </div>
                    <h2 style="color: #57F287;">Покупка успешна!</h2>
                    <p>Заказ: <strong>${escapeHtml(orderId)}</strong></p>
                    <p>Товар: <strong>${escapeHtml(productName)}</strong></p>
                    <div style="background: var(--gray-50); padding: 15px; border-radius: 12px; margin: 20px 0;">
                        <p style="margin: 0;">Остаток на балансе:</p>
                        <p style="font-size: 1.5rem; color: #57F287; margin: 5px 0 0 0;">${newBalance} ₽</p>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-primary" onclick="location.reload()">Ок</button>
                        <button class="btn-secondary" onclick="window.location.href='/profile.html#orders'">Мои заказы</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        setTimeout(() => {
            const modal = document.getElementById('successModal');
            if (modal) modal.remove();
        }, 5000);
    }
    
    function showInsufficientFundsModal(price, balance, productName) {
        const modalHtml = `
            <div class="modal" id="insufficientModal">
                <div class="modal-content" style="text-align: center;">
                    <div style="width: 70px; height: 70px; background: #ED4245; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                        <i class="fas fa-exclamation-triangle" style="color: white; font-size: 2rem;"></i>
                    </div>
                    <h2 style="color: #ED4245;">Недостаточно средств</h2>
                    <p>Для покупки "${escapeHtml(productName)}"</p>
                    <div style="background: var(--gray-50); padding: 15px; border-radius: 12px; margin: 20px 0;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <span>Стоимость:</span>
                            <span style="color: #ED4245; font-weight: 600;">${price} ₽</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Ваш баланс:</span>
                            <span style="color: #ED4245; font-weight: 600;">${balance} ₽</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-light);">
                            <span>Не хватает:</span>
                            <span style="color: #ED4245; font-weight: 600;">${price - balance} ₽</span>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-primary" onclick="window.location.href='/profile.html#balance'">Пополнить баланс</button>
                        <button class="btn-secondary" onclick="this.closest('.modal').remove()">Закрыть</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
    
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        const icon = type === 'success' ? 'check-circle' : (type === 'error' ? 'exclamation-circle' : (type === 'warning' ? 'exclamation-triangle' : 'info-circle'));
        toast.innerHTML = `<i class="fas fa-${icon}"></i> ${escapeHtml(message)}`;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    function showLoading(container) {
        container.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Загрузка товаров...</p>
            </div>
        `;
    }
    
    function renderEmptyState(title, message) {
        const container = document.getElementById('productsContainer');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-box-open"></i>
                    <h3>${escapeHtml(title)}</h3>
                    <p>${escapeHtml(message)}</p>
                </div>
            `;
        }
    }
    
    function renderErrorState(title, error) {
        const container = document.getElementById('productsContainer');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>${escapeHtml(title)}</h3>
                    <p>${escapeHtml(error)}</p>
                    <button class="btn-primary" onclick="location.reload()">
                        <i class="fas fa-sync-alt"></i> Попробовать снова
                    </button>
                </div>
            `;
        }
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
    
    // Экспорт глобальных функций
    window.showToast = showToast;
    window.getDiscountInfo = getDiscountInfo;
    window.filterProductsByCategory = filterProductsByCategory;
    window.renderProducts = renderProducts;
    window.updateURL = updateURL;
})();