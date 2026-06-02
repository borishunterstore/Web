// payment.js - Оптимизированная система оплаты
class PaymentSystem {
    constructor() {
        this.init();
    }

    init() {
        console.log('✅ PaymentSystem загружен');
    }

    calculateDiscountedPrice(originalPrice, productId) {
        if (!window.promocodeSystem) return originalPrice;
        const { finalPrice } = window.promocodeSystem.getDiscountForProduct(originalPrice, productId);
        return finalPrice;
    }

    async createOrder(userId, productId, productName, price, originalPrice, username, promocodes, discount, discountAmount) {
        const orderId = `BH-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        
        const response = await fetch('/api/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId, productId, productName, price, originalPrice, username,
                promocodes, discount, discountAmount, orderId
            })
        });
        
        return response.json();
    }

    showPaymentModal(productName, originalPrice, productId) {
        const discountInfo = window.promocodeSystem?.getDiscountForProduct(originalPrice, productId) || { finalPrice: originalPrice, discount: 0, discountAmount: 0 };
        const finalPrice = discountInfo.finalPrice;
        
        const modalHtml = `
            <div class="modal" id="paymentModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2><i class="fas fa-shopping-cart"></i> Подтверждение покупки</h2>
                        <button class="modal-close" onclick="closePaymentModal()">×</button>
                    </div>
                    <div class="purchase-details">
                        <div class="purchase-row">
                            <span class="purchase-label"><i class="fas fa-box"></i> Товар:</span>
                            <span class="purchase-value">${this.escapeHtml(productName)}</span>
                        </div>
                        ${discountInfo.discount > 0 ? `
                            <div class="purchase-row">
                                <span class="purchase-label"><i class="fas fa-tag"></i> Оригинал:</span>
                                <span class="purchase-value" style="text-decoration:line-through">${originalPrice} ₽</span>
                            </div>
                            <div class="purchase-row">
                                <span class="purchase-label"><i class="fas fa-percent"></i> Скидка (${discountInfo.discount}%):</span>
                                <span class="purchase-value highlight">-${discountInfo.discountAmount} ₽</span>
                            </div>
                        ` : ''}
                        <div class="purchase-row">
                            <span class="purchase-label"><i class="fas fa-credit-card"></i> Итого:</span>
                            <span class="purchase-value highlight">${finalPrice} ₽</span>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-primary" onclick="confirmPayment('${this.escapeHtml(productId)}', '${this.escapeHtml(productName)}', ${originalPrice}, ${finalPrice})">Подтвердить</button>
                        <button class="btn-secondary" onclick="closePaymentModal()">Отмена</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
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
}

window.paymentSystem = new PaymentSystem();

window.confirmPayment = async (productId, productName, originalPrice, finalPrice) => {
    const auth = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
    if (!auth.id) {
        alert('Авторизуйтесь');
        window.location.href = '/auth.html';
        return;
    }
    
    const discountInfo = window.promocodeSystem?.getDiscountForProduct(originalPrice, productId) || {};
    
    try {
        const result = await window.paymentSystem.createOrder(
            auth.id, productId, productName, finalPrice, originalPrice,
            auth.username, discountInfo.appliedPromocodes?.map(p => p.code) || [],
            discountInfo.discount || 0, discountInfo.discountAmount || 0
        );
        
        if (result.success) {
            closePaymentModal();
            showPaymentSuccess(productName, result.newBalance);
            
            if (discountInfo.appliedPromocodes?.length) {
                discountInfo.appliedPromocodes.forEach(p => window.promocodeSystem?.removeDiscount(p.code));
            }
            
            auth.balance = result.newBalance;
            localStorage.setItem('bhstore_auth', JSON.stringify(auth));
            window.updateUserBalance?.(result.newBalance);
            setTimeout(() => location.reload(), 3000);
        } else {
            alert('Ошибка: ' + result.error);
        }
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
};

function closePaymentModal() {
    document.getElementById('paymentModal')?.remove();
}

function showPaymentSuccess(productName, newBalance) {
    closePaymentModal();
    
    const modalHtml = `
        <div class="modal" id="successModal">
            <div class="modal-content" style="text-align:center">
                <div style="width:70px;height:70px;background:#57F287;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px">
                    <i class="fas fa-check" style="color:#1e1f29;font-size:2rem"></i>
                </div>
                <h2 style="color:#57F287">Покупка успешна!</h2>
                <p>Товар: <strong>${escapeHtml(productName)}</strong></p>
                <div style="background:#1e1f29;padding:15px;border-radius:12px;margin:20px 0">
                    <p>Остаток на балансе:</p>
                    <p style="font-size:1.5rem;color:#57F287">${newBalance} ₽</p>
                </div>
                <button class="btn-primary" onclick="location.reload()">Ок</button>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    setTimeout(() => document.getElementById('successModal')?.remove(), 5000);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, (m) => {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}