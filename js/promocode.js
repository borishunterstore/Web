class PromocodeSystem {
    constructor() {
        this.activeDiscounts = []; 
        this.userPromocodes = []; 
        this.isProcessing = false;

        this.elements = {
            input: document.getElementById('promocodeInput'),
            button: document.getElementById('applyPromocodeBtn'),
            message: document.getElementById('promocodeMessage'),
            section: document.getElementById('promocodeSection')
        };

        this.init();
    }

    async init() {
        await this.loadFromAPI();
        this.initEventListeners();
        this.renderUI();
    }

    async loadFromAPI() {
        const auth = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        if (!auth.id) return;

        try {
            if (window.api) {
                const historyData = await window.api.request(`/promocodes/user/${auth.id}`);
                if (historyData.success) {
                    this.userPromocodes = historyData.promocodes || [];
                }

                const activeData = await window.api.request(`/promocodes/active/${auth.id}`);
                if (activeData.success) {
                    this.activeDiscounts = activeData.promocodes || [];
                }
            } else {
                const historyRes = await fetch(`/.netlify/functions/server/promocodes/user/${auth.id}`);
                const historyData = await historyRes.json();
                if (historyData.success) {
                    this.userPromocodes = historyData.promocodes || [];
                }

                const activeRes = await fetch(`/.netlify/functions/server/promocodes/active/${auth.id}`);
                const activeData = await activeRes.json();
                if (activeData.success) {
                    this.activeDiscounts = activeData.promocodes || [];
                }
            }
        } catch (e) { 
            console.error('Ошибка загрузки промокодов:', e);
            this.loadFromStorage();
        }
    }

    loadFromStorage() {
        const saved = localStorage.getItem('bhstore_active_promocodes');
        if (saved) {
            try { 
                this.activeDiscounts = JSON.parse(saved).activeDiscounts || []; 
            } catch (e) { 
                this.activeDiscounts = []; 
            }
        }
    }

    async saveToAPI() {
        const auth = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        if (!auth.id) return;

        try {
            if (window.api) {
                await window.api.request('/promocodes/save-active', {
                    method: 'POST',
                    body: JSON.stringify({ 
                        userId: auth.id, 
                        activeDiscounts: this.activeDiscounts 
                    })
                });
            } else {
                await fetch('/.netlify/functions/server/promocodes/save-active', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        userId: auth.id, 
                        activeDiscounts: this.activeDiscounts 
                    })
                });
            }
        } catch (e) {
            console.error('Ошибка сохранения промокодов:', e);
            this.saveToStorage();
        }
    }

    saveToStorage() {
        localStorage.setItem('bhstore_active_promocodes', JSON.stringify({
            activeDiscounts: this.activeDiscounts
        }));
    }

    initEventListeners() {
        if (this.elements.input) {
            this.elements.input.addEventListener('keypress', (e) => { 
                if (e.key === 'Enter') this.applyPromocode(); 
            });
        }
        if (this.elements.button) {
            this.elements.button.addEventListener('click', () => this.applyPromocode());
        }
    }

    // Получение итоговой цены со скидкой
    getDiscountedPrice(originalPrice, productId = null) {
        if (!this.activeDiscounts || this.activeDiscounts.length === 0) return originalPrice;
        
        // Фильтруем применимые промокоды (глобальные или на конкретный товар)
        const applicable = this.activeDiscounts.filter(d => !d.productId || d.productId === productId);
        if (applicable.length === 0) return originalPrice;
        
        // Суммируем скидки (максимум 90%)
        let totalDiscount = applicable.reduce((sum, d) => sum + (d.value || 0), 0);
        totalDiscount = Math.min(totalDiscount, 90);
        
        return Math.round(originalPrice * (100 - totalDiscount) / 100);
    }

    // Получение информации о применённых скидках
    getAppliedDiscounts(productId = null) {
        if (!this.activeDiscounts) return [];
        return productId 
            ? this.activeDiscounts.filter(d => !d.productId || d.productId === productId)
            : this.activeDiscounts;
    }

    async applyPromocode() {
        if (this.isProcessing) return;
        
        const code = this.elements.input?.value.trim().toUpperCase();
        if (!code) return this.showMessage('Введите код', 'error');

        const auth = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        if (!auth.id) return this.showMessage('Авторизуйтесь', 'error');

        this.setLoading(true);

        try {
            let checkData;
            let activateData;

            if (window.api) {
                checkData = await window.api.request('/promocodes/check', {
                    method: 'POST',
                    body: JSON.stringify({ userId: auth.id, code: code })
                });

                if (!checkData.success) {
                    return this.showMessage(checkData.error || 'Промокод недействителен', 'error');
                }

                activateData = await window.api.request('/promocodes/activate', {
                    method: 'POST',
                    body: JSON.stringify({ userId: auth.id, code: code })
                });
            } else {
                const checkRes = await fetch('/.netlify/functions/server/promocodes/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: auth.id, code: code })
                });
                checkData = await checkRes.json();

                if (!checkData.success) {
                    return this.showMessage(checkData.error || 'Промокод недействителен', 'error');
                }

                const activateRes = await fetch('/.netlify/functions/server/promocodes/activate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: auth.id, code: code })
                });
                activateData = await activateRes.json();
            }

            if (activateData.success) {
                const promo = checkData.promocode;
                
                if (promo.type === 'discount') {
                    // Добавляем скидку
                    this.activeDiscounts.push({
                        code: promo.code,
                        value: promo.value,
                        type: 'discount',
                        appliedAt: new Date().toISOString()
                    });
                    
                    await this.saveToAPI();
                    
                    this.showMessage(`✓ Промокод активирован! Скидка ${promo.value}%`, 'success');
                    
                    // 🔄 ОБНОВЛЯЕМ МАГАЗИН
                    this.refreshShopDisplay();
                    
                } else if (promo.type === 'balance') {
                    this.showMessage(`💰 Баланс пополнен на ${promo.value} ₽`, 'success');
                    
                    if (typeof loadProfile === 'function') {
                        await loadProfile();
                    }
                }
                
                if (this.elements.input) this.elements.input.value = '';
                
                await this.loadFromAPI();
                this.renderUI();
                
            } else {
                this.showMessage(activateData.error || 'Ошибка активации', 'error');
            }
        } catch (e) {
            console.error('Ошибка применения промокода:', e);
            this.showMessage('Ошибка сервера', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    // Единый метод удаления промокода (без дублирования)
    async removeDiscount(code) {
        const auth = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        if (!auth.id) return;

        try {
            if (window.api) {
                await window.api.request('/promocodes/remove-active', {
                    method: 'POST',
                    body: JSON.stringify({ userId: auth.id, code: code })
                });
            } else {
                await fetch('/.netlify/functions/server/promocodes/remove-active', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: auth.id, code: code })
                });
            }
            
            this.activeDiscounts = this.activeDiscounts.filter(p => p.code !== code);
            await this.saveToAPI();
            this.renderUI();
            this.showMessage('Промокод удален', 'info');
            
            // 🔄 ОБНОВЛЯЕМ МАГАЗИН
            this.refreshShopDisplay();
            
        } catch (e) {
            console.error('Ошибка удаления промокода:', e);
            this.showMessage('Ошибка при удалении', 'error');
        }
    }

    // Обновление отображения магазина
    refreshShopDisplay() {
        // Способ 1: через глобальную функцию из shop.js
        if (typeof window.updateProductsDisplay === 'function') {
            console.log('🔄 Обновляем товары через updateProductsDisplay');
            window.updateProductsDisplay();
        }
        
        // Способ 2: через shopSystem (для обратной совместимости)
        if (window.shopSystem && typeof window.shopSystem.updatePrices === 'function') {
            console.log('🔄 Обновляем товары через shopSystem');
            window.shopSystem.updatePrices(this.activeDiscounts);
        }
        
        // Способ 3: перезагружаем страницу товаров если есть глобальная функция renderProducts
        if (typeof window.renderProducts === 'function' && window.allProducts) {
            console.log('🔄 Обновляем товары через renderProducts');
            const currentCategory = document.querySelector('.category-btn.active')?.dataset.category || 'all';
            window.renderProducts(window.allProducts, currentCategory);
        }
        
        // Способ 4: обновляем цены на главной странице если есть
        if (typeof updateHomePagePrices === 'function') {
            updateHomePagePrices();
        }
        
        // Обновляем UI промокодов в магазине
        const shopPromoContainer = document.getElementById('shopActivePromocodes');
        const promocodeSection = document.getElementById('promocodeSection');
        
        if (shopPromoContainer) {
            if (this.activeDiscounts.length > 0) {
                if (promocodeSection) promocodeSection.style.display = 'block';
                
                shopPromoContainer.innerHTML = this.activeDiscounts.map(promo => `
                    <div class="promocode-item">
                        <div class="promocode-info">
                            <div class="promocode-icon">
                                <i class="fas fa-ticket-alt"></i>
                            </div>
                            <div class="promocode-details">
                                <h4>${this.escapeHtml(promo.code)}</h4>
                                <p><i class="fas fa-percent"></i> Скидка: ${promo.value}%</p>
                            </div>
                        </div>
                        <div class="promocode-value">-${promo.value}%</div>
                        <button class="btn-remove-promocode" onclick="window.promocodeSystem?.removeDiscount('${this.escapeHtml(promo.code)}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `).join('');
            } else {
                if (promocodeSection) promocodeSection.style.display = 'none';
            }
        }
        
        // Обновляем счётчик промокодов
        const countEl = document.getElementById('promocodeCount');
        if (countEl) countEl.textContent = this.activeDiscounts.length;
    }

    getDiscountForProduct(productId, price) {
        return this.getDiscountedPrice(price, productId);
    }

    setLoading(state) {
        this.isProcessing = state;
        if (!this.elements.button) return;
        
        this.elements.button.disabled = state;
        this.elements.button.innerHTML = state 
            ? '<i class="fas fa-spinner fa-spin"></i> Проверка...' 
            : '<i class="fas fa-tag"></i> Активировать';
    }

    showMessage(text, type) {
        if (!this.elements.message) return;
        
        const icons = { 
            success: 'check-circle', 
            error: 'exclamation-circle', 
            info: 'info-circle' 
        };
        
        const bg = { 
            success: '#57F287', 
            error: '#ED4245', 
            info: '#5865F2' 
        };

        this.elements.message.innerHTML = `
            <div class="promo-msg-box promo-animate" style="background: ${bg[type]}; color: white;">
                <i class="fas fa-${icons[type]}"></i>
                <span>${text}</span>
            </div>
        `;
        
        setTimeout(() => { 
            if (this.elements.message) {
                this.elements.message.innerHTML = ''; 
            }
        }, 4000);
    }

    renderUI() {
        if (!this.elements.section) return;
        
        let wrapper = document.getElementById('activePromosWrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = 'activePromosWrapper';
            this.elements.section.appendChild(wrapper);
        }

        if (this.activeDiscounts.length === 0) {
            wrapper.innerHTML = '';
            return;
        }

        wrapper.innerHTML = `
            <div class="promo-title promo-animate">
                <i class="fas fa-fire"></i> Активные скидки
            </div>
            ${this.activeDiscounts.map(p => `
                <div class="active-promo-item promo-animate">
                    <div class="promo-info-text">
                        <span class="promo-code-name">${this.escapeHtml(p.code)}</span>
                        <span class="promo-value">Скидка ${p.value}%</span>
                        <span class="promo-date">${new Date(p.appliedAt).toLocaleDateString()}</span>
                    </div>
                    <button class="btn-remove-promo" onclick="promocodeSystem.removeDiscount('${this.escapeHtml(p.code)}')">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `).join('')}
        `;
    }

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Создаём глобальный экземпляр
const promocodeSystem = new PromocodeSystem();
window.promocodeSystem = promocodeSystem;