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
        // Запускаем проверку истекших промокодов каждые 5 минут
        setInterval(() => this.clearExpiredPromocodes(), 5 * 60 * 1000);
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
                    // Проверяем истекшие промокоды при загрузке
                    this.clearExpiredPromocodes();
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
                    this.clearExpiredPromocodes();
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
                if (e.key === 'Enter') {
                    const code = this.elements.input.value.trim().toUpperCase();
                    if (code) this.applyPromocodeByCode(code);
                }
            });
        }
        if (this.elements.button) {
            this.elements.button.addEventListener('click', () => {
                const code = this.elements.input?.value.trim().toUpperCase();
                if (code) this.applyPromocodeByCode(code);
            });
        }
    }

    // Проверка срока действия промокода
    isPromocodeExpired(promocode) {
        if (!promocode.expires_at) return false;
        
        const now = new Date();
        const expiresAt = new Date(promocode.expires_at);
        
        if (now > expiresAt) {
            console.log(`⏰ Промокод ${promocode.code} истек ${expiresAt.toLocaleDateString()}`);
            return true;
        }
        return false;
    }

    // Очистка истекших промокодов
    async clearExpiredPromocodes() {
        const expiredBefore = this.activeDiscounts.filter(p => this.isPromocodeExpired(p));
        
        if (expiredBefore.length > 0) {
            console.log(`🗑️ Очищаем ${expiredBefore.length} истекших промокодов`);
            for (const promo of expiredBefore) {
                await this.removeDiscount(promo.code);
            }
            this.refreshShopDisplay();
        }
    }

    // Получение итоговой цены со скидкой
    getDiscountedPrice(originalPrice, productId = null) {
        if (!this.activeDiscounts || this.activeDiscounts.length === 0) return originalPrice;
        
        // Фильтруем неистекшие промокоды
        const validDiscounts = this.activeDiscounts.filter(d => !this.isPromocodeExpired(d));
        if (validDiscounts.length === 0) return originalPrice;
        
        // Фильтруем применимые промокоды (глобальные или на конкретный товар)
        const applicable = validDiscounts.filter(d => !d.productId || d.productId === productId);
        if (applicable.length === 0) return originalPrice;
        
        // Суммируем скидки (максимум 90%)
        let totalDiscount = applicable.reduce((sum, d) => sum + (d.value || 0), 0);
        totalDiscount = Math.min(totalDiscount, 90);
        
        return Math.round(originalPrice * (100 - totalDiscount) / 100);
    }

    // Получение информации о применённых скидках
    getAppliedDiscounts(productId = null) {
        if (!this.activeDiscounts) return [];
        const validDiscounts = this.activeDiscounts.filter(d => !this.isPromocodeExpired(d));
        return productId 
            ? validDiscounts.filter(d => !d.productId || d.productId === productId)
            : validDiscounts;
    }

    // ОСНОВНОЙ МЕТОД АКТИВАЦИИ ПРОМОКОДА
    async applyPromocodeByCode(code) {
        if (this.isProcessing) return;
        
        if (!code) {
            this.showMessage('Введите промокод', 'error');
            return;
        }

        const auth = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        if (!auth.id) {
            this.showMessage('Авторизуйтесь для активации промокода', 'error');
            setTimeout(() => window.location.href = '/auth.html', 2000);
            return;
        }

        this.setLoading(true);

        try {
            // Проверяем промокод
            const checkData = await window.api.request('/promocodes/check', {
                method: 'POST',
                body: JSON.stringify({ userId: auth.id, code: code })
            });

            if (!checkData.success) {
                this.showMessage(checkData.error || 'Промокод недействителен', 'error');
                this.setLoading(false);
                return;
            }

            // Активируем
            const activateData = await window.api.request('/promocodes/activate', {
                method: 'POST',
                body: JSON.stringify({ userId: auth.id, code: code })
            });

            if (activateData.success) {
                const promo = checkData.promocode;
                
                // ===== ДЛЯ СКИДОЧНЫХ ПРОМОКОДОВ =====
                if (promo.type === 'discount') {
                    const newPromo = {
                        code: promo.code,
                        value: promo.value,
                        type: 'discount',
                        appliedAt: new Date().toISOString(),
                        expires_at: activateData.expires_at,
                        valid_days: activateData.valid_days,
                        product_ids: promo.product_ids || [] // ID товаров, на которые действует скидка
                    };
                    this.activeDiscounts.push(newPromo);
                    await this.saveToAPI();
                    
                    let message = `✓ Промокод активирован! Скидка ${promo.value}%`;
                    if (activateData.expires_at) {
                        const expireDate = new Date(activateData.expires_at).toLocaleDateString('ru-RU');
                        message += ` (действует до ${expireDate})`;
                    }
                    if (promo.product_ids && promo.product_ids.length > 0) {
                        message += ` на выбранные товары`;
                    } else {
                        message += ` на все товары`;
                    }
                    this.showMessage(message, 'success');
                    
                // ===== ДЛЯ БАЛАНСОВЫХ ПРОМОКОДОВ =====
                } else if (promo.type === 'balance') {
                    let message = `💰 Баланс пополнен на ${promo.value} ₽`;
                    
                    if (activateData.newBalance !== undefined && activateData.newBalance !== null) {
                        message += ` (новый баланс: ${activateData.newBalance} ₽)`;
                        
                        // Обновляем баланс на странице
                        if (window.renderBalance) {
                            window.renderBalance(activateData.newBalance);
                        }
                        if (typeof loadProfile === 'function') {
                            await loadProfile();
                        }
                        
                        // Обновляем локальное хранилище
                        const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
                        authData.balance = activateData.newBalance;
                        localStorage.setItem('bhstore_auth', JSON.stringify(authData));
                    }
                    
                    this.showMessage(message, 'success');
                }
                
                // Очищаем поле ввода
                if (this.elements.input) this.elements.input.value = '';
                
                // Обновляем историю промокодов
                if (typeof loadUserPromocodes === 'function') {
                    await loadUserPromocodes();
                }
                
                // Обновляем данные
                await this.loadFromAPI();
                this.renderUI();
                this.refreshShopDisplay();
                
                // Показываем модальное окно
                if (window.showPromocodeInfo) {
                    window.showPromocodeInfo({
                        ...activateData,
                        message: activateData.message,
                        newBalance: activateData.newBalance,
                        value: promo.value,
                        type: promo.type,
                        code: promo.code
                    });
                }
                
            } else {
                this.showMessage(activateData.error || 'Ошибка активации', 'error');
            }
        } catch (e) {
            console.error('Ошибка применения промокода:', e);
            this.showMessage('Ошибка сервера: ' + (e.message || 'неизвестная ошибка'), 'error');
        } finally {
            this.setLoading(false);
        }
    }

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
            this.refreshShopDisplay();
            
        } catch (e) {
            console.error('Ошибка удаления промокода:', e);
            this.showMessage('Ошибка при удалении', 'error');
        }
    }

    refreshShopDisplay() {
        // Обновляем через глобальную функцию из shop.js
        if (typeof window.updateProductsDisplay === 'function') {
            console.log('🔄 Обновляем товары через updateProductsDisplay');
            window.updateProductsDisplay();
        }
        
        // Перезагружаем страницу товаров если есть глобальная функция renderProducts
        if (typeof window.renderProducts === 'function' && window.allProducts) {
            console.log('🔄 Обновляем товары через renderProducts');
            const currentCategory = document.querySelector('.category-btn.active')?.dataset.category || 'all';
            window.renderProducts(window.allProducts, currentCategory);
        }
        
        // Обновляем цены на главной странице если есть
        if (typeof updateHomePagePrices === 'function') {
            updateHomePagePrices();
        }
        
        // Обновляем UI промокодов в магазине
        this.updateShopPromocodeUI();
        
        // Обновляем счётчик промокодов
        const countEl = document.getElementById('promocodeCount');
        const validCount = this.activeDiscounts.filter(p => !this.isPromocodeExpired(p)).length;
        if (countEl) countEl.textContent = validCount;
    }

    updateShopPromocodeUI() {
        const shopPromoContainer = document.getElementById('shopActivePromocodes');
        const promocodeSection = document.getElementById('promocodeSection');
        
        if (!shopPromoContainer) return;
        
        const validDiscounts = this.activeDiscounts.filter(p => !this.isPromocodeExpired(p));
        
        if (validDiscounts.length > 0) {
            if (promocodeSection) promocodeSection.style.display = 'block';
            
            shopPromoContainer.innerHTML = validDiscounts.map(promo => `
                <div class="promocode-item">
                    <div class="promocode-info">
                        <div class="promocode-icon">
                            <i class="fas fa-ticket-alt"></i>
                        </div>
                        <div class="promocode-details">
                            <h4>${this.escapeHtml(promo.code)}</h4>
                            <p><i class="fas fa-percent"></i> Скидка: ${promo.value}%</p>
                            ${promo.expires_at ? `
                                <p class="promocode-expires" style="font-size: 0.7rem; color: #FEE75C; margin-top: 4px;">
                                    <i class="fas fa-clock"></i> 
                                    Действует до: ${new Date(promo.expires_at).toLocaleDateString('ru-RU')}
                                </p>
                            ` : ''}
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
            shopPromoContainer.innerHTML = '';
        }
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
                <span>${this.escapeHtml(text)}</span>
            </div>
        `;
        
        setTimeout(() => { 
            if (this.elements.message) {
                this.elements.message.innerHTML = ''; 
            }
        }, 5000);
    }

    renderUI() {
        if (!this.elements.section) return;
        
        let wrapper = document.getElementById('activePromosWrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = 'activePromosWrapper';
            this.elements.section.appendChild(wrapper);
        }

        const validDiscounts = this.activeDiscounts.filter(p => !this.isPromocodeExpired(p));

        if (validDiscounts.length === 0) {
            wrapper.innerHTML = '';
            return;
        }

        wrapper.innerHTML = `
            <div class="promo-title promo-animate">
                <i class="fas fa-fire"></i> Активные скидки
            </div>
            ${validDiscounts.map(p => `
                <div class="active-promo-item promo-animate">
                    <div class="promo-info-text">
                        <span class="promo-code-name">${this.escapeHtml(p.code)}</span>
                        <span class="promo-value">Скидка ${p.value}%</span>
                        <span class="promo-date">${new Date(p.appliedAt).toLocaleDateString()}</span>
                        ${p.expires_at ? `
                            <span class="promo-expires" style="display: block; font-size: 0.7rem; color: #FEE75C;">
                                Действует до: ${new Date(p.expires_at).toLocaleDateString('ru-RU')}
                            </span>
                        ` : ''}
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