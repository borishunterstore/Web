// payment.js - Система оплаты через баланс с поддержкой промокодов
class PaymentSystem {
    constructor() {
        this.api = new BHStoreAPI();
        this.isProcessing = false; // Флаг для предотвращения двойных покупок
        console.log('✅ PaymentSystem инициализирован');
    }

    // Генерация уникального номера заказа
    generateOrderId() {
        return 'BH-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    }

    // Получение данных пользователя с сервера
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

    // Получение баланса пользователя
    async getUserBalance(userId) {
        try {
            const user = await this.getUserData(userId);
            return user ? user.balance || 0 : 0;
        } catch (error) {
            console.error('Ошибка получения баланса:', error);
            return 0;
        }
    }

    // Расчет итоговой цены с учетом всех активных промокодов
    calculateDiscountedPrice(originalPrice, productId = null) {
        if (!window.promocodeSystem || !window.promocodeSystem.activeDiscounts) {
            return originalPrice;
        }
        
        // Получаем все промокоды, которые применяются к этому товару
        const applicableDiscounts = window.promocodeSystem.activeDiscounts.filter(promocode => 
            !promocode.productId || promocode.productId === productId
        );
        
        if (applicableDiscounts.length === 0) {
            return originalPrice;
        }
        
        // Суммируем скидки (максимум 90%)
        let totalDiscount = 0;
        applicableDiscounts.forEach(promocode => {
            totalDiscount += promocode.value;
        });
        
        // Ограничиваем максимальную скидку 90%
        totalDiscount = Math.min(totalDiscount, 90);
        
        // Рассчитываем итоговую цену
        const discountedPrice = Math.round(originalPrice * (1 - totalDiscount / 100));
        
        return discountedPrice;
    }

    // Получение информации о примененных скидках
// Получение информации о примененных скидках
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
    
    // Рассчитываем скидку
    let totalDiscount = 0;
    applicableDiscounts.forEach(promocode => {
        totalDiscount += promocode.value;
    });
    
    // Ограничиваем максимальную скидку 90%
    totalDiscount = Math.min(totalDiscount, 90);
    
    // Правильный расчет скидки: 100% - скидка%
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

    // Показ модального окна оплаты через баланс с учетом промокодов
    async showPaymentModal(productName, originalPrice, productId) {
        console.log(`🔄 showPaymentModal вызван: productName=${productName}, originalPrice=${originalPrice}, productId=${productId}`);
        
        // Предотвращаем двойное открытие
        if (document.getElementById('paymentModal')) {
            return;
        }

        const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        
        if (!authData.id) {
            alert('Пожалуйста, авторизуйтесь для покупки товаров');
            window.location.href = '/auth.html';
            return;
        }

        // Получаем актуальный баланс с сервера
        const userBalance = await this.getUserBalance(authData.id);
        console.log(`💰 Баланс пользователя: ${userBalance} ₽`);
        
        // Рассчитываем итоговую цену с учетом промокодов
        const discountInfo = this.getDiscountInfo(originalPrice, productId);
        const finalPrice = discountInfo.finalPrice;
        
        console.log(`📊 Информация о скидках:`, discountInfo);
        console.log(`💳 Итоговая цена: ${finalPrice} ₽`);
        
        // Проверяем достаточно ли средств
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
        
        // Проверяем что цены правильные
        console.log(`✅ Отображение модального окна: оригинальная=${originalPrice}, итоговая=${finalPrice}`);
        
        // Генерируем HTML для информации о промокодах
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

        // Добавляем обработчик кнопки подтверждения
        document.getElementById('confirmPurchaseBtn').addEventListener('click', () => {
            this.confirmPurchase(orderId, productId, productName, finalPrice, originalPrice, authData.id);
        });

        // Добавляем метод для удаления модального окна
        window.removePaymentModal = () => {
            const modal = document.getElementById('paymentModal');
            if (modal) modal.remove();
        };
    }

    // Показ окна при недостаточных средствах
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

        // Добавляем метод для удаления модального окна
        window.removeInsufficientFundsModal = () => {
            const modal = document.getElementById('insufficientFundsModal');
            if (modal) modal.remove();
        };
    }

    // Подтверждение покупки (с защитой от двойных покупок)
    async confirmPurchase(orderId, productId, productName, finalPrice, originalPrice, userId) {
        console.log(`✅ Подтверждение покупки: orderId=${orderId}, finalPrice=${finalPrice}, originalPrice=${originalPrice}`);
        
        // Защита от двойных покупок
        if (this.isProcessing) {
            console.log('⚠️ Покупка уже обрабатывается, пропускаем...');
            return;
        }
        
        this.isProcessing = true;
    
        try {
            // Блокируем кнопку
            const confirmBtn = document.getElementById('confirmPurchaseBtn');
            if (confirmBtn) {
                confirmBtn.disabled = true;
                confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Обработка...';
                confirmBtn.style.opacity = '0.7';
                confirmBtn.style.cursor = 'not-allowed';
            }
    
            // Показываем статус обработки
            this.showPaymentStatus('Обработка покупки...');
    
            // Получаем актуальные данные пользователя
            const userData = await this.getUserData(userId);
            if (!userData) {
                throw new Error('Не удалось получить данные пользователя');
            }
    
            // Проверяем баланс еще раз
            if (userData.balance < finalPrice) {
                throw new Error('Недостаточно средств на балансе');
            }
    
            // Получаем информацию о примененных промокодах
            const discountInfo = this.getDiscountInfo(originalPrice, productId);
            const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
    
            // Отправляем запрос на создание заказа
            const orderData = {
                orderId: orderId,
                userId: userId,
                productId: productId,
                productName: productName,
                originalPrice: originalPrice, // Оригинальная цена
                finalPrice: finalPrice,       // Цена со скидкой
                username: authData.username,
                type: 'balance',
                status: 'completed'
            };
    
            // Добавляем информацию о промокодах если они были применены
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
                // Обновляем локальные данные пользователя ИЗ ОТВЕТА СЕРВЕРА
                authData.balance = result.newBalance || (authData.balance - finalPrice);
                
                // Обновляем бейдж "Покупатель"
                if (!authData.badges) authData.badges = {};
                authData.badges.buyer = true;
                
                localStorage.setItem('bhstore_auth', JSON.stringify(authData));
                
                // Удаляем использованные промокоды (если они были применены)
                if (discountInfo.appliedPromocodes.length > 0 && window.promocodeSystem) {
                    discountInfo.appliedPromocodes.forEach(promocode => {
                        window.promocodeSystem.removeDiscountPromocode(promocode.code);
                    });
                }
                
                // Показываем успешное сообщение
                this.showSuccessMessage(orderId, productName, authData.balance, discountInfo);
                
                // Обновляем интерфейс
                if (typeof updateAuthButton === 'function') {
                    updateAuthButton();
                }
                
                // Обновляем кнопки на странице магазина
                if (typeof updateProductButtons === 'function') {
                    updateProductButtons();
                }
            } else {
                throw new Error(result.error || 'Ошибка при создании заказа');
            }
        } catch (error) {
            console.error('❌ Ошибка покупки:', error);
            this.showPaymentStatus('Ошибка покупки: ' + error.message, true);
            
            // Разблокируем кнопку при ошибке
            const confirmBtn = document.getElementById('confirmPurchaseBtn');
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="fas fa-check"></i> Подтвердить покупку';
                confirmBtn.style.opacity = '1';
                confirmBtn.style.cursor = 'pointer';
            }
        } finally {
            // Снимаем блокировку через 3 секунды
            setTimeout(() => {
                this.isProcessing = false;
            }, 3000);
        }
    }

    // Показ статуса оплаты
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

        // Автоматическое скрытие
        setTimeout(() => {
            if (statusDiv) statusDiv.remove();
        }, isError ? 5000 : 3000);
    }

    // Успешная покупка с информацией о скидках
    showSuccessMessage(orderId, productName, newBalance, discountInfo) {
        // Удаляем модальное окно оплаты
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

        // Генерируем информацию о скидках
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

        // Автоматическое закрытие через 5 секунд
        setTimeout(() => {
            if (successDiv) {
                successDiv.remove();
            }
            location.reload();
        }, 5000);
    }
}

// Инициализация системы оплаты
const paymentSystem = new PaymentSystem();

// Функция для покупки товара с учетом промокодов
async function buyProduct(productId, productName, originalPrice) {
    try {
        const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        
        // Проверка авторизации
        if (!authData.username) {
            alert('Пожалуйста, авторизуйтесь для покупки товаров');
            window.location.href = '/auth.html';
            return;
        }

        // Если есть verificationCode, пользователь не завершил регистрацию
        if (authData.verificationCode) {
            alert('Пожалуйста, завершите регистрацию, введя код верификации');
            window.location.href = '/verify.html';
            return;
        }

        // Проверяем баланс через API
        const response = await fetch(`/api/user/${authData.id}`);
        const data = await response.json();
        
        if (!data.success || !data.user) {
            throw new Error('Не удалось получить данные пользователя');
        }

        const userBalance = data.user.balance || 0;

        // Рассчитываем итоговую цену с учетом промокодов
        let finalPrice = originalPrice;
        if (window.paymentSystem) {
            finalPrice = window.paymentSystem.calculateDiscountedPrice(originalPrice, productId);
        }

        // Если баланса недостаточно, показываем окно пополнения
        if (userBalance < finalPrice) {
            if (window.paymentSystem) {
                window.paymentSystem.showInsufficientFundsModal(finalPrice, userBalance, productName);
            } else {
                alert(`Недостаточно средств! Нужно: ${finalPrice} ₽, у вас: ${userBalance} ₽`);
            }
            return;
        }

        // Используем новую систему оплаты
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

// Обновление кнопок товаров с учетом промокодов
function updateProductButtons() {
    document.querySelectorAll('.btn-buy').forEach(button => {
        const productId = button.dataset.productId;
        const productName = button.dataset.productName;
        const originalPrice = parseFloat(button.dataset.price);
        
        // Рассчитываем актуальную цену с учетом промокодов
        let displayPrice = originalPrice;
        if (window.paymentSystem) {
            displayPrice = window.paymentSystem.calculateDiscountedPrice(originalPrice, productId);
        }
        
        // Обновляем цену на кнопке если она отображается
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

// Функция для обновления цен на странице в реальном времени
function updatePagePrices() {
    // Обновляем цены на всех товарах
    document.querySelectorAll('.product-card').forEach(card => {
        const productId = card.querySelector('.btn-buy')?.dataset.productId;
        const originalPrice = parseFloat(card.querySelector('.btn-buy')?.dataset.price);
        
        if (productId && originalPrice && window.paymentSystem) {
            const finalPrice = window.paymentSystem.calculateDiscountedPrice(originalPrice, productId);
            const discountInfo = window.paymentSystem.getDiscountInfo(originalPrice, productId);
            
            // Обновляем отображение цены
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

// Глобальные функции
window.buyProduct = buyProduct;
window.updateProductButtons = updateProductButtons;
window.updatePagePrices = updatePagePrices;
window.paymentSystem = paymentSystem;

// Добавляем обработчик для кнопок при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    if (typeof updateProductButtons === 'function') {
        setTimeout(updateProductButtons, 1000);
    }
    
    // Обновляем цены при изменении активных промокодов
    if (window.promocodeSystem) {
        // Создаем наблюдатель для отслеживания изменений в activeDiscounts
        const observer = new MutationObserver(() => {
            if (typeof updatePagePrices === 'function') {
                updatePagePrices();
            }
        });
        
        // Начинаем наблюдение за изменениями в promocodeSystem
        observer.observe(window.promocodeSystem, {
            attributes: true,
            childList: true,
            subtree: true
        });
    }
});