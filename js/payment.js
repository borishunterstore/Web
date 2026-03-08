class PaymentSystem {
    constructor() {
        this.api = new BHStoreAPI();
        this.isProcessing = false;
        console.log('✅ PaymentSystem инициализирован');
    }

    generateOrderId() {
        return 'BH-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    }

    async getUserData(userId) {
        try {
            const response = await fetch(`/api/user/${userId}`);
            const data = await response.json();
            
            if (data.success && data.user) {
                return data.user;
            }
            return null;
        } catch (error) {
            console.error('Ошибка получения данных пользователя:', error);
            return null;
        }
    }

    async getUserBalance(userId) {
        try {
            const user = await this.getUserData(userId);
            return user ? user.balance || 0 : 0;
        } catch (error) {
            console.error('Ошибка получения баланса:', error);
            return 0;
        }
    }

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
        
        const discountedPrice = Math.round(originalPrice * (1 - totalDiscount / 100));
        
        return discountedPrice;
    }

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
    const discountMultiplier = (100 - totalDiscount) / 100;
    const finalPrice = Math.round(originalPrice * discountMultiplier);
    const discountAmount = originalPrice - finalPrice;
    
    console.log(`🧮 Расчет скидки: ${originalPrice} * (${100 - totalDiscount}/100) = ${finalPrice} ₽`);
    
    return {
        originalPrice: originalPrice,
        finalPrice: finalPrice,
        discount: totalDiscount,
        discountAmount: discountAmount,
        appliedPromocodes: applicableDiscounts
    };
}

    async showPaymentModal(productName, originalPrice, productId) {
        console.log(`🔄 showPaymentModal вызван: productName=${productName}, originalPrice=${originalPrice}, productId=${productId}`);
        
        if (document.getElementById('paymentModal')) {
            return;
        }

        const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        
        if (!authData.id) {
            alert('Пожалуйста, авторизуйтесь для покупки товаров');
            window.location.href = '/auth.html';
            return;
        }

        const userBalance = await this.getUserBalance(authData.id);
        console.log(`💰 Баланс пользователя: ${userBalance} ₽`);
        
        const discountInfo = this.getDiscountInfo(originalPrice, productId);
        const finalPrice = discountInfo.finalPrice;
        
        console.log(`📊 Информация о скидках:`, discountInfo);
        console.log(`💳 Итоговая цена: ${finalPrice} ₽`);
        
        if (userBalance < finalPrice) {
            this.showInsufficientFundsModal(finalPrice, userBalance, productName);
            return;
        }

        const modal = document.createElement('div');
        modal.id = 'paymentModal';
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
            font-family: 'Segoe UI', sans-serif;
        `;

        const orderId = this.generateOrderId();
        
        console.log(`✅ Отображение модального окна: оригинальная=${originalPrice}, итоговая=${finalPrice}`);
        
        let promocodeHTML = '';
        if (discountInfo.appliedPromocodes.length > 0) {
            promocodeHTML = `
                <div style="background: #1e1f29; padding: 1rem; border-radius: 6px; margin-top: 1rem;">
                    <div style="color: #57F287; font-weight: 600; margin-bottom: 0.5rem;">
                        <i class="fas fa-ticket-alt"></i> Применены промокоды:
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 5px;">
                        ${discountInfo.appliedPromocodes.map(promocode => `
                            <div style="display: flex; justify-content: space-between;">
                                <span style="color: #b9bbbe;">${promocode.code}</span>
                                <span style="color: #57F287;">-${promocode.value}%</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        modal.innerHTML = `
            <div style="background: #2a2b36; border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2 style="color: white; margin: 0;">Оплата через баланс</h2>
                    <button onclick="this.removePaymentModal()" 
                            style="background: none; border: none; color: #b9bbbe; font-size: 1.5rem; cursor: pointer;">
                        ×
                    </button>
                </div>
                
                <div style="background: #202225; padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="color: #b9bbbe;">Товар:</span>
                        <span style="color: white; font-weight: 500;">${productName}</span>
                    </div>
                    
                    ${discountInfo.discount > 0 ? `
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <span style="color: #b9bbbe;">Оригинальная цена:</span>
                            <span style="color: #b9bbbe; text-decoration: line-through;">${originalPrice} ₽</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; background: #1e1f29; padding: 0.5rem; border-radius: 4px;">
                            <span style="color: #b9bbbe;">Скидка (${discountInfo.discount}%):</span>
                            <span style="color: #57F287; font-weight: 600;">-${discountInfo.discountAmount} ₽</span>
                        </div>
                    ` : ''}
                    
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="color: #b9bbbe;">Итоговая сумма:</span>
                        <span style="color: #57F287; font-weight: 600; font-size: 1.2rem;">${finalPrice} ₽</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="color: #b9bbbe;">Ваш баланс:</span>
                        <span style="color: ${userBalance >= finalPrice ? '#57F287' : '#ED4245'}; font-weight: 600;">
                            ${userBalance} ₽
                        </span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 0.5rem;">
                        <span style="color: #b9bbbe;">Останется на балансе:</span>
                        <span style="color: ${userBalance >= finalPrice ? '#57F287' : '#ED4245'}; font-weight: 600;">
                            ${userBalance - finalPrice} ₽
                        </span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 0.5rem;">
                        <span style="color: #b9bbbe;">Номер заказа:</span>
                        <span style="color: #5865F2; font-weight: 500;">${orderId}</span>
                    </div>
                    
                    ${promocodeHTML}
                </div>

                <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
                    <button id="confirmPurchaseBtn" 
                            style="flex: 1; padding: 1rem; background: #57F287; color: #1e1f29; border: none; border-radius: 8px; 
                                   font-size: 1rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <i class="fas fa-check"></i> Подтвердить покупку
                    </button>
                    <button onclick="this.removePaymentModal()" 
                            style="flex: 1; padding: 1rem; background: #ED4245; color: white; border: none; border-radius: 8px; 
                                   font-size: 1rem; font-weight: 600; cursor: pointer;">
                        Отмена
                    </button>
                </div>

                <div style="color: #b9bbbe; font-size: 0.9rem; text-align: center; padding: 1rem; background: #202225; border-radius: 8px;">
                    <p style="margin: 0;">
                        <i class="fas fa-info-circle"></i> 
                        После подтверждения средства будут списаны с вашего баланса, а товар появится в разделе "Мои покупки".
                        ${discountInfo.discount > 0 ? 'Использованные промокоды будут деактивированы.' : ''}
                    </p>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('confirmPurchaseBtn').addEventListener('click', () => {
            this.confirmPurchase(orderId, productId, productName, finalPrice, originalPrice, authData.id);
        });

        window.removePaymentModal = () => {
            const modal = document.getElementById('paymentModal');
            if (modal) modal.remove();
        };
    }

    showInsufficientFundsModal(price, balance, productName) {
        const modal = document.createElement('div');
        modal.id = 'insufficientFundsModal';
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
            font-family: 'Segoe UI', sans-serif;
        `;

        modal.innerHTML = `
            <div style="background: #2a2b36; border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%;">
                <div style="text-align: center; margin-bottom: 1.5rem;">
                    <div style="width: 80px; height: 80px; background: #ED4245; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
                        <i class="fas fa-exclamation-triangle" style="color: white; font-size: 2.5rem;"></i>
                    </div>
                    <h2 style="color: white; margin: 0 0 0.5rem 0;">Недостаточно средств</h2>
                    <p style="color: #b9bbbe;">Для покупки товара не хватает средств на балансе</p>
                </div>
                
                <div style="background: #202225; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="color: #b9bbbe;">Товар:</span>
                        <span style="color: white; font-weight: 500;">${productName}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="color: #b9bbbe;">Стоимость:</span>
                        <span style="color: #ED4245; font-weight: 600;">${price} ₽</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="color: #b9bbbe;">Ваш баланс:</span>
                        <span style="color: #ED4245; font-weight: 600;">${balance} ₽</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 0.5rem;">
                        <span style="color: #b9bbbe;">Не хватает:</span>
                        <span style="color: #ED4245; font-weight: 600;">${price - balance} ₽</span>
                    </div>
                </div>

                <div style="display: flex; gap: 1rem;">
                    <button onclick="window.location.href='/profile.html#balance'" 
                            style="flex: 1; padding: 1rem; background: #5865F2; color: white; border: none; border-radius: 8px; 
                                   font-size: 1rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <i class="fas fa-coins"></i> Пополнить баланс
                    </button>
                    <button onclick="this.removeInsufficientFundsModal()" 
                            style="flex: 1; padding: 1rem; background: #40444b; color: white; border: none; border-radius: 8px; 
                                   font-size: 1rem; font-weight: 600; cursor: pointer;">
                        Закрыть
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        window.removeInsufficientFundsModal = () => {
            const modal = document.getElementById('insufficientFundsModal');
            if (modal) modal.remove();
        };
    }

    async confirmPurchase(orderId, productId, productName, finalPrice, originalPrice, userId) {
        console.log(`✅ Подтверждение покупки: orderId=${orderId}, finalPrice=${finalPrice}, originalPrice=${originalPrice}`);
        
        if (this.isProcessing) {
            console.log('⚠️ Покупка уже обрабатывается, пропускаем...');
            return;
        }
        
        this.isProcessing = true;
    
        try {
            const confirmBtn = document.getElementById('confirmPurchaseBtn');
            if (confirmBtn) {
                confirmBtn.disabled = true;
                confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Обработка...';
                confirmBtn.style.opacity = '0.7';
                confirmBtn.style.cursor = 'not-allowed';
            }
    
            this.showPaymentStatus('Обработка покупки...');
    
            const userData = await this.getUserData(userId);
            if (!userData) {
                throw new Error('Не удалось получить данные пользователя');
            }
    
            if (userData.balance < finalPrice) {
                throw new Error('Недостаточно средств на балансе');
            }
    
            const discountInfo = this.getDiscountInfo(originalPrice, productId);
            const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
    
            const orderData = {
                orderId: orderId,
                userId: userId,
                productId: productId,
                productName: productName,
                originalPrice: originalPrice,
                finalPrice: finalPrice,
                username: authData.username,
                type: 'balance',
                status: 'completed'
            };
    
            if (discountInfo.appliedPromocodes.length > 0) {
                orderData.promocodes = discountInfo.appliedPromocodes.map(p => p.code);
                orderData.discount = discountInfo.discount;
                orderData.discountAmount = discountInfo.discountAmount;
                
                console.log(`🎫 Применены промокоды: ${orderData.promocodes.join(', ')}`);
                console.log(`📊 Скидка: ${discountInfo.discount}% (${discountInfo.discountAmount} ₽)`);
            }
    
            console.log('📤 Отправка запроса на покупку:', orderData);
    
            const response = await fetch('/api/create-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(orderData)
            });
    
            const result = await response.json();
            console.log('📥 Ответ от сервера:', result);
    
            if (result.success) {
                authData.balance = result.newBalance || (authData.balance - finalPrice);
                
                if (!authData.badges) authData.badges = {};
                authData.badges.buyer = true;
                
                localStorage.setItem('bhstore_auth', JSON.stringify(authData));
                
                if (discountInfo.appliedPromocodes.length > 0 && window.promocodeSystem) {
                    discountInfo.appliedPromocodes.forEach(promocode => {
                        window.promocodeSystem.removeDiscountPromocode(promocode.code);
                    });
                }
                
                this.showSuccessMessage(orderId, productName, authData.balance, discountInfo);
                
                if (typeof updateAuthButton === 'function') {
                    updateAuthButton();
                }
                
                if (typeof updateProductButtons === 'function') {
                    updateProductButtons();
                }
            } else {
                throw new Error(result.error || 'Ошибка при создании заказа');
            }
        } catch (error) {
            console.error('❌ Ошибка покупки:', error);
            this.showPaymentStatus('Ошибка покупки: ' + error.message, true);
            
            const confirmBtn = document.getElementById('confirmPurchaseBtn');
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="fas fa-check"></i> Подтвердить покупку';
                confirmBtn.style.opacity = '1';
                confirmBtn.style.cursor = 'pointer';
            }
        } finally {
            setTimeout(() => {
                this.isProcessing = false;
            }, 3000);
        }
    }

    showPaymentStatus(message, isError = false) {
        let statusDiv = document.getElementById('paymentStatus');
        
        if (!statusDiv) {
            statusDiv = document.createElement('div');
            statusDiv.id = 'paymentStatus';
            statusDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${isError ? '#ED4245' : '#202225'};
                color: white;
                padding: 1rem;
                border-radius: 8px;
                z-index: 10001;
                min-width: 300px;
                box-shadow: 0 5px 20px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                gap: 10px;
            `;
            document.body.appendChild(statusDiv);
        }

        statusDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                ${!isError ? `<div class="spinner" style="width: 20px; height: 20px; border: 2px solid #5865F2; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>` : ''}
                <span>${message}</span>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;

        setTimeout(() => {
            if (statusDiv) statusDiv.remove();
        }, isError ? 5000 : 3000);
    }

    showSuccessMessage(orderId, productName, newBalance, discountInfo) {
        if (typeof window.removePaymentModal === 'function') {
            window.removePaymentModal();
        }

        const successDiv = document.createElement('div');
        successDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;

        let discountHTML = '';
        if (discountInfo && discountInfo.discount > 0) {
            discountHTML = `
                <div style="background: #202225; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <div style="color: #57F287; font-weight: 600; margin-bottom: 0.5rem;">
                        <i class="fas fa-tag"></i> Примененные скидки:
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #b9bbbe;">Оригинальная цена:</span>
                            <span style="color: #b9bbbe; text-decoration: line-through;">${discountInfo.originalPrice} ₽</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #b9bbbe;">Скидка (${discountInfo.discount}%):</span>
                            <span style="color: #57F287;">-${discountInfo.discountAmount} ₽</span>
                        </div>
                        ${discountInfo.appliedPromocodes.length > 0 ? `
                            <div style="color: #b9bbbe; font-size: 0.9rem; margin-top: 0.5rem;">
                                <i class="fas fa-ticket-alt"></i> Промокоды: 
                                ${discountInfo.appliedPromocodes.map(p => p.code).join(', ')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        successDiv.innerHTML = `
            <div style="background: #2a2b36; padding: 3rem; border-radius: 12px; text-align: center; max-width: 500px; width: 90%;">
                <div style="width: 80px; height: 80px; background: #57F287; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 2rem;">
                    <i class="fas fa-check" style="color: #1e1f29; font-size: 2.5rem;"></i>
                </div>
                <h2 style="color: #57F287; margin-bottom: 1rem;">Покупка успешна!</h2>
                <p style="color: #b9bbbe; margin-bottom: 0.5rem;">Заказ <strong>${orderId}</strong> оплачен.</p>
                <p style="color: #b9bbbe; margin-bottom: 0.5rem;">Товар: <strong>${productName}</strong></p>
                <p style="color: #b9bbbe; margin-bottom: 0.5rem;">Статус: <span style="color: #57F287; font-weight: 600;">ОПЛАЧЕНО</span></p>
                
                ${discountHTML}
                
                <div style="background: #202225; padding: 1rem; border-radius: 8px; margin-bottom: 2rem;">
                    <p style="color: #b9bbbe; margin: 0;">Остаток на балансе:</p>
                    <p style="color: #57F287; font-size: 1.5rem; font-weight: 600; margin: 0.5rem 0 0 0;">${newBalance} ₽</p>
                </div>
                
                <div style="display: flex; gap: 1rem;">
                    <button onclick="location.reload()" style="flex: 1; padding: 1rem; background: #5865F2; color: white; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer;">
                        Ок
                    </button>
                    <button onclick="window.location.href='/profile.html#orders'; if(successDiv) successDiv.remove();" style="flex: 1; padding: 1rem; background: #40444b; color: white; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer;">
                        Мои заказы
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(successDiv);

        setTimeout(() => {
            if (successDiv) {
                successDiv.remove();
            }
            location.reload();
        }, 5000);
    }
}

const paymentSystem = new PaymentSystem();

async function buyProduct(productId, productName, originalPrice) {
    try {
        const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        
        if (!authData.username) {
            alert('Пожалуйста, авторизуйтесь для покупки товаров');
            window.location.href = '/auth.html';
            return;
        }

        if (authData.verificationCode) {
            alert('Пожалуйста, завершите регистрацию, введя код верификации');
            window.location.href = '/verify.html';
            return;
        }

        const response = await fetch(`/api/user/${authData.id}`);
        const data = await response.json();
        
        if (!data.success || !data.user) {
            throw new Error('Не удалось получить данные пользователя');
        }

        const userBalance = data.user.balance || 0;

        let finalPrice = originalPrice;
        if (window.paymentSystem) {
            finalPrice = window.paymentSystem.calculateDiscountedPrice(originalPrice, productId);
        }

        if (userBalance < finalPrice) {
            if (window.paymentSystem) {
                window.paymentSystem.showInsufficientFundsModal(finalPrice, userBalance, productName);
            } else {
                alert(`Недостаточно средств! Нужно: ${finalPrice} ₽, у вас: ${userBalance} ₽`);
            }
            return;
        }

        if (window.paymentSystem) {
            await window.paymentSystem.showPaymentModal(productName, originalPrice, productId);
        } else {
            alert('Система оплаты не загружена. Попробуйте обновить страницу.');
        }

    } catch (error) {
        console.error('Ошибка при покупке товара:', error);
        alert('Ошибка: ' + error.message);
    }
}

function updateProductButtons() {
    document.querySelectorAll('.btn-buy').forEach(button => {
        const productId = button.dataset.productId;
        const productName = button.dataset.productName;
        const originalPrice = parseFloat(button.dataset.price);
        
        let displayPrice = originalPrice;
        if (window.paymentSystem) {
            displayPrice = window.paymentSystem.calculateDiscountedPrice(originalPrice, productId);
        }
        
        const priceElement = button.querySelector('.price') || button;
        if (priceElement.textContent.includes('₽')) {
            priceElement.textContent = priceElement.textContent.replace(/\d+ ₽/, `${displayPrice} ₽`);
        }
        
        button.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            buyProduct(productId, productName, originalPrice);
        };
    });
}

function updatePagePrices() {
    document.querySelectorAll('.product-card').forEach(card => {
        const productId = card.querySelector('.btn-buy')?.dataset.productId;
        const originalPrice = parseFloat(card.querySelector('.btn-buy')?.dataset.price);
        
        if (productId && originalPrice && window.paymentSystem) {
            const finalPrice = window.paymentSystem.calculateDiscountedPrice(originalPrice, productId);
            const discountInfo = window.paymentSystem.getDiscountInfo(originalPrice, productId);
            
            const priceElement = card.querySelector('.product-price');
            if (priceElement) {
                if (discountInfo.discount > 0) {
                    priceElement.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="color: #b9bbbe; text-decoration: line-through; font-size: 0.9rem;">
                                ${originalPrice} ₽
                            </span>
                            <span style="color: #57F287; font-weight: 600; font-size: 1.1rem;">
                                ${finalPrice} ₽
                            </span>
                            <span style="background: #57F287; color: #1e1f29; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">
                                -${discountInfo.discount}%
                            </span>
                        </div>
                    `;
                } else {
                    priceElement.textContent = `${finalPrice} ₽`;
                }
            }
        }
    });
}

window.buyProduct = buyProduct;
window.updateProductButtons = updateProductButtons;
window.updatePagePrices = updatePagePrices;
window.paymentSystem = paymentSystem;

document.addEventListener('DOMContentLoaded', () => {
    if (typeof updateProductButtons === 'function') {
        setTimeout(updateProductButtons, 1000);
    }
    
    if (window.promocodeSystem) {
        const observer = new MutationObserver(() => {
            if (typeof updatePagePrices === 'function') {
                updatePagePrices();
            }
        });
        
        document.addEventListener('DOMContentLoaded', () => {
            if (typeof updateProductButtons === 'function') {
                setTimeout(updateProductButtons, 1000);
            }
            
            if (window.promocodeSystem) {
                document.addEventListener('promocodeChanged', function() {
                    if (typeof updatePagePrices === 'function') {
                        updatePagePrices();
                    }
                });
                
                const originalAddDiscount = window.promocodeSystem.addDiscountPromocode;
                if (originalAddDiscount) {
                    window.promocodeSystem.addDiscountPromocode = function(code, value, productId) {
                        const result = originalAddDiscount.call(this, code, value, productId);
                        document.dispatchEvent(new CustomEvent('promocodeChanged'));
                        return result;
                    };
                }
                
                const originalRemoveDiscount = window.promocodeSystem.removeDiscountPromocode;
                if (originalRemoveDiscount) {
                    window.promocodeSystem.removeDiscountPromocode = function(code) {
                        const result = originalRemoveDiscount.call(this, code);
                        document.dispatchEvent(new CustomEvent('promocodeChanged'));
                        return result;
                    };
                }
            }
        });
    }
});