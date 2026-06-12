class PromocodeSystem {
    constructor() {
        this.activeDiscounts = [];
        this.isProcessing = false;
        this.messageTimeout = null;
        this.onBalanceUpdate = null;
        this.onPromocodeActivated = null;
        this.init();
    }

    async init() {
        await this.loadFromAPI();
        this.renderUI();
        this.setupEventListeners();
        console.log('✅ Промокоды загружены:', this.activeDiscounts.length);
    }

    async loadFromAPI() {
        const auth = this.getAuth();
        if (!auth?.id) return;
        
        try {
            const response = await window.api.request('/promocodes/active/' + auth.id);
            if (response.success && response.promocodes) {
                this.activeDiscounts = response.promocodes;
                await this.saveToAPI();
            }
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            this.loadFromStorage();
        }
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem('bhstore_active_promocodes');
            if (saved) this.activeDiscounts = JSON.parse(saved);
        } catch (error) {
            console.error('Ошибка загрузки из storage:', error);
        }
    }

    async saveToAPI() {
        const auth = this.getAuth();
        if (!auth?.id) return;
        
        try {
            await window.api.request('/promocodes/save-active', {
                method: 'POST',
                body: JSON.stringify({ userId: auth.id, activeDiscounts: this.activeDiscounts })
            });
            localStorage.setItem('bhstore_active_promocodes', JSON.stringify(this.activeDiscounts));
        } catch (error) {
            console.error('Ошибка сохранения:', error);
        }
    }

    async applyPromocodeByCode(code) {
        if (this.isProcessing) return;
        
        const auth = this.getAuth();
        if (!auth?.id) {
            alert('Авторизуйтесь');
            return;
        }
        
        this.setLoading(true);
        
        try {
            const checkData = await window.api.request('/promocodes/check', {
                method: 'POST',
                body: JSON.stringify({ userId: auth.id, code: code.toUpperCase() })
            });
            
            if (!checkData.success) {
                this.showMessage(checkData.error || 'Промокод недействителен', 'error');
                this.setLoading(false);
                return;
            }
            
            const activateData = await window.api.request('/promocodes/activate', {
                method: 'POST',
                body: JSON.stringify({ userId: auth.id, code: code.toUpperCase() })
            });
            
            if (activateData.success) {
                const promo = checkData.promocode;
                
                if (promo.type === 'discount') {
                    this.activeDiscounts.push({
                        code: promo.code,
                        value: promo.value,
                        type: 'discount',
                        appliedAt: new Date().toISOString(),
                        expires_at: activateData.expires_at
                    });
                    await this.saveToAPI();
                    this.showMessage(`✓ Скидка ${promo.value}% активирована!`, 'success');
                    window.updateProductsDisplay?.();
                    
                } else if (promo.type === 'balance') {
                    this.showMessage(`💰 Баланс пополнен на ${promo.value} ₽`, 'success');
                    this.onBalanceUpdate?.(activateData.newBalance);
                    const authData = this.getAuth();
                    if (authData && activateData.newBalance !== undefined) {
                        authData.balance = activateData.newBalance;
                        localStorage.setItem('bhstore_auth', JSON.stringify(authData));
                    }
                }
                
                const input = document.getElementById('promocodeInput');
                if (input) input.value = '';
                
                await this.loadFromAPI();
                this.renderUI();
                this.onPromocodeActivated?.(activateData);
            } else {
                this.showMessage(activateData.error || 'Ошибка активации', 'error');
            }
        } catch (error) {
            this.showMessage('Ошибка сервера', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    removeDiscount(code) {
        this.activeDiscounts = this.activeDiscounts.filter(d => d.code !== code);
        this.saveToAPI();
        this.renderUI();
        window.updateProductsDisplay?.();
    }

    renderUI() {
        const container = document.getElementById('shopActivePromocodes');
        if (!container) return;
        
        if (!this.activeDiscounts.length) {
            container.innerHTML = `<div class="empty-promocodes"><i class="fas fa-ticket-alt"></i><p>Нет активных промокодов</p></div>`;
            return;
        }
        
        container.innerHTML = this.activeDiscounts.map(promo => `
            <div class="promocode-item">
                <div class="promocode-info">
                    <div class="promocode-icon"><i class="fas fa-ticket-alt"></i></div>
                    <div class="promocode-details">
                        <h4>${this.escapeHtml(promo.code)}</h4>
                        <p><i class="fas fa-percent"></i> Скидка: ${promo.value}%</p>
                        ${promo.expires_at ? `<p class="promocode-expires"><i class="fas fa-clock"></i> до ${new Date(promo.expires_at).toLocaleDateString()}</p>` : ''}
                    </div>
                </div>
                <div class="promocode-value">-${promo.value}%</div>
                <button class="btn-remove-promocode" onclick="window.promocodeSystem?.removeDiscount('${this.escapeHtml(promo.code)}')"><i class="fas fa-times"></i></button>
            </div>
        `).join('');
    }

    getDiscountForProduct(originalPrice, productId = null) {
        if (!this.activeDiscounts.length) return { finalPrice: originalPrice, discount: 0, discountAmount: 0 };
        
        const applicable = this.activeDiscounts.filter(promo => !promo.product_ids?.length || promo.product_ids.includes(productId));
        const totalDiscount = Math.min(applicable.reduce((sum, d) => sum + (d.value || 0), 0), 90);
        const finalPrice = Math.round(originalPrice * (100 - totalDiscount) / 100);
        
        return {
            finalPrice,
            discount: totalDiscount,
            discountAmount: originalPrice - finalPrice,
            appliedPromocodes: applicable
        };
    }

    showMessage(message, type) {
        const container = document.getElementById('promocodeMessage');
        if (!container) return;
        
        container.innerHTML = `<div class="promocode-message ${type}"><i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>${message}</div>`;
        
        if (this.messageTimeout) clearTimeout(this.messageTimeout);
        this.messageTimeout = setTimeout(() => {
            if (container) container.innerHTML = '';
        }, 5000);
    }

    setLoading(loading) {
        const btn = document.getElementById('applyPromocodeBtn');
        if (!btn) return;
        
        this.isProcessing = loading;
        btn.disabled = loading;
        btn.innerHTML = loading ? '<i class="fas fa-spinner fa-spin"></i> Проверка...' : '<i class="fas fa-check"></i> Активировать';
    }

    getAuth() {
        try {
            return JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        } catch {
            return {};
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, (m) => {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    setupEventListeners() {
        const input = document.getElementById('promocodeInput');
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const code = e.target.value.trim().toUpperCase();
                    if (code) this.applyPromocodeByCode(code);
                }
            });
        }
    }
}

window.promocodeSystem = new PromocodeSystem();