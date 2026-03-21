// payment.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
class PaymentSystem {
    constructor() {
        console.log('✅ PaymentSystem инициализирован');
    }

    // Функция расчета цены со скидкой
    calculateDiscountedPrice(originalPrice, productId = null) {
        if (!window.promocodeSystem || !window.promocodeSystem.activeDiscounts) {
            return originalPrice;
        }
        
        const applicableDiscounts = window.promocodeSystem.activeDiscounts.filter(promocode => 
            !promocode.productId || promocode.productId === productId
        );
        
        if (applicableDiscounts.length === 0) {
            return originalPrice;
        }
        
        let totalDiscount = 0;
        applicableDiscounts.forEach(promocode => {
            totalDiscount += promocode.value;
        });
        
        totalDiscount = Math.min(totalDiscount, 90);
        const finalPrice = Math.round(originalPrice * (100 - totalDiscount) / 100);
        
        return finalPrice;
    }

    // Функция получения информации о скидке
    getDiscountInfo(originalPrice, productId = null) {
        if (!window.promocodeSystem || !window.promocodeSystem.activeDiscounts) {
            return {
                originalPrice: originalPrice,
                finalPrice: originalPrice,
                discount: 0,
                discountAmount: 0,
                appliedPromocodes: []
            };
        }
        
        const applicableDiscounts = window.promocodeSystem.activeDiscounts.filter(promocode => 
            !promocode.productId || promocode.productId === productId
        );
        
        if (applicableDiscounts.length === 0) {
            return {
                originalPrice: originalPrice,
                finalPrice: originalPrice,
                discount: 0,
                discountAmount: 0,
                appliedPromocodes: []
            };
        }
        
        let totalDiscount = 0;
        applicableDiscounts.forEach(promocode => {
            totalDiscount += promocode.value;
        });
        
        totalDiscount = Math.min(totalDiscount, 90);
        const finalPrice = Math.round(originalPrice * (100 - totalDiscount) / 100);
        const discountAmount = originalPrice - finalPrice;
        
        return {
            originalPrice: originalPrice,
            finalPrice: finalPrice,
            discount: totalDiscount,
            discountAmount: discountAmount,
            appliedPromocodes: applicableDiscounts
        };
    }
    
    showInsufficientFundsModal(price, balance, productName) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        modal.innerHTML = `
            <div style="background: #2a2b36; border-radius: 12px; padding: 2rem; max-width: 400px; width: 90%; text-align: center;">
                <div style="width: 60px; height: 60px; background: #ED4245; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
                    <i class="fas fa-exclamation-triangle" style="color: white; font-size: 1.5rem;"></i>
                </div>
                <h2 style="color: white;">Недостаточно средств</h2>
                <p style="color: #b9bbbe;">Для покупки "${escapeHtml(productName)}" не хватает ${price - balance} ₽</p>
                <div style="background: #202225; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #b9bbbe;">Стоимость:</span>
                        <span style="color: #ED4245;">${price} ₽</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #b9bbbe;">Ваш баланс:</span>
                        <span style="color: #ED4245;">${balance} ₽</span>
                    </div>
                </div>
                <div style="display: flex; gap: 1rem;">
                    <button onclick="window.location.href='/profile.html'" style="flex: 1; padding: 0.8rem; background: #5865F2; color: white; border: none; border-radius: 8px; cursor: pointer;">
                        Пополнить баланс
                    </button>
                    <button onclick="this.closest('div').parentElement.remove()" style="flex: 1; padding: 0.8rem; background: #40444b; color: white; border: none; border-radius: 8px; cursor: pointer;">
                        Закрыть
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
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

const paymentSystem = new PaymentSystem();
window.paymentSystem = paymentSystem;