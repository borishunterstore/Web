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
        await Promise.all([this.loadUserHistory(), this.loadFromStorage()]);
        this.initEventListeners();
        this.renderUI();
    }

    async loadUserHistory() {
        const auth = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        if (!auth.id) return;
        try {
            const res = await fetch(`/api/promocodes/user/${auth.id}`);
            const data = await res.json();
            if (data.success) this.userPromocodes = data.promocodes || [];
        } catch (e) { console.error('History error'); }
    }

    loadFromStorage() {
        const saved = localStorage.getItem('bhstore_active_promocodes');
        if (saved) {
            try { this.activeDiscounts = JSON.parse(saved).activeDiscounts || []; }
            catch (e) { this.activeDiscounts = []; }
        }
    }

    saveToStorage() {
        localStorage.setItem('bhstore_active_promocodes', JSON.stringify({
            activeDiscounts: this.activeDiscounts
        }));
    }

    initEventListeners() {
        if (this.elements.input) {
            this.elements.input.onkeypress = (e) => { if (e.key === 'Enter') this.applyPromocode(); };
        }
        if (this.elements.button) {
            this.elements.button.onclick = () => this.applyPromocode();
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
            const response = await fetch('/api/promocodes/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: auth.id, code: code })
            });

            const data = await response.json();

            if (data.success) {
                const promo = data.promocode;
                if (promo.type === 'discount') {
                    this.activeDiscounts = this.activeDiscounts.filter(p => p.code !== promo.code);
                    this.activeDiscounts.push(promo);
                    this.saveToStorage();
                    this.showMessage(`Активировано: -${promo.value}%`, 'success');
                } else if (promo.type === 'balance') {
                    this.showMessage(`Баланс пополнен: +${promo.value}₽`, 'success');
                    if (window.loadProfileData) window.loadProfileData(auth.id);
                }
                if (this.elements.input) this.elements.input.value = '';
                this.renderUI();
            } else {
                this.showMessage(data.error || 'Ошибка активации', 'error');
            }
        } catch (e) {
            this.showMessage('Ошибка сервера', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    removeDiscount(code) {
        this.activeDiscounts = this.activeDiscounts.filter(p => p.code !== code);
        this.saveToStorage();
        this.renderUI();
        this.showMessage('Промокод удален', 'info');
    }

    setLoading(state) {
        this.isProcessing = state;
        if (!this.elements.button) return;
        this.elements.button.disabled = state;
        this.elements.button.innerHTML = state ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-check"></i> Активировать';
    }

    showMessage(text, type) {
        if (!this.elements.message) return;
        const icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle' };
        const bg = { success: '#57F287', error: '#ED4245', info: '#5865F2' };

        this.elements.message.innerHTML = `
            <div class="promo-msg-box promo-animate" style="background: ${bg[type]}; color: #1e1f29;">
                <i class="fas fa-${icons[type]}"></i>
                <span>${text}</span>
            </div>
        `;
        setTimeout(() => { this.elements.message.innerHTML = ''; }, 4000);
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
                    </div>
                    <button class="btn-remove-promo" onclick="promocodeSystem.removeDiscount('${p.code}')">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `).join('')}
        `;
    }
}

const promocodeSystem = new PromocodeSystem();
window.promocodeSystem = promocodeSystem;