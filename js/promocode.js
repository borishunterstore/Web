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
        await this.loadFromAPI(); // Загружаем с сервера, а не из localStorage
        this.initEventListeners();
        this.renderUI();
    }

    async loadFromAPI() {
        const auth = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        if (!auth.id) return;

        try {
            // Загружаем историю промокодов пользователя
            const historyRes = await fetch(`/api/promocodes/user/${auth.id}`);
            const historyData = await historyRes.json();
            if (historyData.success) {
                this.userPromocodes = historyData.promocodes || [];
            }

            // Загружаем активные промокоды из БД
            const activeRes = await fetch(`/api/promocodes/active/${auth.id}`);
            const activeData = await activeRes.json();
            if (activeData.success) {
                this.activeDiscounts = activeData.promocodes || [];
            }
        } catch (e) { 
            console.error('Ошибка загрузки промокодов:', e);
            // Если сервер недоступен, пробуем загрузить из localStorage как запасной вариант
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

    // Сохраняем на сервер, а не в localStorage
    async saveToAPI() {
        const auth = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        if (!auth.id) return;

        try {
            await fetch('/api/promocodes/save-active', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: auth.id, 
                    activeDiscounts: this.activeDiscounts 
                })
            });
        } catch (e) {
            console.error('Ошибка сохранения промокодов:', e);
            // Запасной вариант - сохраняем локально
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

    async applyPromocode() {
        if (this.isProcessing) return;
        
        const code = this.elements.input?.value.trim().toUpperCase();
        if (!code) return this.showMessage('Введите код', 'error');

        const auth = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        if (!auth.id) return this.showMessage('Авторизуйтесь', 'error');

        this.setLoading(true);

        try {
            // Сначала проверяем промокод
            const checkRes = await fetch('/api/promocodes/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: auth.id, code: code })
            });

            const checkData = await checkRes.json();

            if (!checkData.success) {
                return this.showMessage(checkData.error || 'Промокод недействителен', 'error');
            }

            // Активируем промокод
            const activateRes = await fetch('/api/promocodes/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: auth.id, code: code })
            });

            const activateData = await activateRes.json();

            if (activateData.success) {
                const promo = checkData.promocode; // Используем данные из check
                
                if (promo.type === 'discount') {
                    // Добавляем скидку в активные
                    this.activeDiscounts.push({
                        code: promo.code,
                        value: promo.value,
                        type: 'discount',
                        appliedAt: new Date().toISOString()
                    });
                    
                    // Сохраняем на сервер
                    await this.saveToAPI();
                    
                    this.showMessage(`✓ Промокод активирован! Скидка ${promo.value}%`, 'success');
                    
                    // Обновляем цены в магазине, если есть такая функция
                    if (window.shopSystem && window.shopSystem.updatePrices) {
                        window.shopSystem.updatePrices(this.activeDiscounts);
                    }
                    
                } else if (promo.type === 'balance') {
                    this.showMessage(`💰 Баланс пополнен на ${promo.value} ₽`, 'success');
                    
                    // Обновляем баланс в интерфейсе
                    if (window.loadProfileData) {
                        window.loadProfileData(auth.id);
                    }
                }
                
                if (this.elements.input) this.elements.input.value = '';
                
                // Обновляем историю
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

    async removeDiscount(code) {
        const auth = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        if (!auth.id) return;

        try {
            // Удаляем с сервера
            await fetch('/api/promocodes/remove-active', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: auth.id, 
                    code: code 
                })
            });
            
            // Удаляем локально
            this.activeDiscounts = this.activeDiscounts.filter(p => p.code !== code);
            
            // Сохраняем изменения
            await this.saveToAPI();
            
            this.renderUI();
            this.showMessage('Промокод удален', 'info');
            
            // Обновляем цены в магазине
            if (window.shopSystem && window.shopSystem.updatePrices) {
                window.shopSystem.updatePrices(this.activeDiscounts);
            }
            
        } catch (e) {
            console.error('Ошибка удаления промокода:', e);
            this.showMessage('Ошибка при удалении', 'error');
        }
    }

    // Получить активную скидку для товара
    getDiscountForProduct(productId, price) {
        if (!this.activeDiscounts || this.activeDiscounts.length === 0) return price;
        
        // Берем максимальную скидку
        const maxDiscount = Math.max(...this.activeDiscounts.map(d => d.value || 0));
        if (maxDiscount > 0) {
            return Math.round(price * (100 - maxDiscount) / 100);
        }
        return price;
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
                        <span class="promo-code-name">${p.code}</span>
                        <span class="promo-value">Скидка ${p.value}%</span>
                        <span class="promo-date">${new Date(p.appliedAt).toLocaleDateString()}</span>
                    </div>
                    <button class="btn-remove-promo" onclick="promocodeSystem.removeDiscount('${p.code}')">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `).join('')}
        `;
    }
}

// Создаем глобальный экземпляр
const promocodeSystem = new PromocodeSystem();

// Делаем доступным глобально
window.promocodeSystem = promocodeSystem;