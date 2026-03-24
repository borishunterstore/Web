// admin-stats.js - Статистика и настройки магазина
class AdminStats {
    constructor() {
        this.api = window.api; 
        this.baseUrl = 'https://bhstore.netlify.app/.netlify/functions';
        this.shopClosed = false;
    }

    async loadStats() {
        try {
            const data = await this.api.getStats();
            this.renderStats(data);
            await this.loadShopSettings();
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
            this.showNotification(this.api.formatError(error), 'error');
        }
    }

    async loadShopSettings() {
        try {
            // Загружаем статус магазина из localStorage или с сервера
            const saved = localStorage.getItem('bhstore_shop_closed');
            this.shopClosed = saved === 'true';
            
            // Обновляем чекбокс
            const checkbox = document.getElementById('shopClosedToggle');
            if (checkbox) {
                checkbox.checked = this.shopClosed;
            }
        } catch (error) {
            console.error('Ошибка загрузки настроек:', error);
        }
    }

    async toggleShopClosed(closed) {
        this.shopClosed = closed;
        localStorage.setItem('bhstore_shop_closed', closed);
        
        // Отправляем уведомление в Discord
        try {
            const status = closed ? '❌ ЗАКРЫТ' : '✅ ОТКРЫТ';
            const color = closed ? 0xED4245 : 0x57F287;
            
            await this.api.sendWebhook({
                title: '🏪 Статус магазина изменен',
                description: `Магазин теперь **${status}**`,
                color: color,
                fields: [
                    { name: '🕐 Время', value: new Date().toLocaleString('ru-RU'), inline: true },
                    { name: '👤 Администратор', value: localStorage.getItem('bhstore_auth') ? JSON.parse(localStorage.getItem('bhstore_auth')).username : 'Неизвестен', inline: true }
                ]
            });
        } catch (error) {
            console.error('Ошибка отправки уведомления:', error);
        }
        
        this.showNotification(`Магазин ${closed ? 'закрыт' : 'открыт'}`, closed ? 'warning' : 'success');
        
        // Обновляем отображение статуса
        this.updateShopStatusDisplay(closed);
    }

    updateShopStatusDisplay(closed) {
        const statusElement = document.getElementById('shopStatus');
        if (statusElement) {
            statusElement.innerHTML = closed 
                ? '<span style="color: #ED4245;"><i class="fas fa-ban"></i> Магазин закрыт</span>'
                : '<span style="color: #57F287;"><i class="fas fa-check-circle"></i> Магазин открыт</span>';
        }
    }

    renderStats(data) {
        const statsContent = document.getElementById('statsContent');
        if (!statsContent) return;

        const stats = data.stats || {};
        const totalUsers = stats.totalUsers || 0;
        const totalOrders = stats.totalOrders || 0;
        const revenue = stats.revenue || 0;
        const newUsers = stats.newUsers || 0;
        const newOrders = stats.newOrders || 0;
        const conversion = stats.conversion || 0;

        statsContent.innerHTML = `
            <!-- Панель управления магазином -->
            <div style="background: linear-gradient(135deg, #2a2b36, #1e1f29); border-radius: 16px; padding: 25px; margin-bottom: 30px; border: 2px solid ${this.shopClosed ? '#ED4245' : '#57F287'};">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px;">
                    <div>
                        <h3 style="color: white; margin-bottom: 10px;">
                            <i class="fas fa-store"></i> Управление магазином
                        </h3>
                        <div id="shopStatus" style="font-size: 1.1rem; margin-top: 5px;">
                            ${this.shopClosed ? '<span style="color: #ED4245;"><i class="fas fa-ban"></i> Магазин закрыт</span>' : '<span style="color: #57F287;"><i class="fas fa-check-circle"></i> Магазин открыт</span>'}
                        </div>
                        <p style="color: #b9bbbe; font-size: 0.9rem; margin-top: 10px;">
                            <i class="fas fa-info-circle"></i>
                            Закрытие / Открытие магазина
                        </p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <span style="color: white;">Магазин закрыт</span>
                            <div class="toggle-switch">
                                <input type="checkbox" id="shopClosedToggle" ${this.shopClosed ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </div>
                        </label>
                    </div>
                </div>
            </div>
            
            <!-- Карточки статистики -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px;">
                <div class="stat-card" style="background: linear-gradient(135deg, #5865F2, #4752c4); padding: 25px; border-radius: 16px;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-users" style="font-size: 1.5rem; color: white;"></i>
                        </div>
                        <div>
                            <div style="color: rgba(255,255,255,0.8); font-size: 0.9rem;">Всего пользователей</div>
                            <div style="color: white; font-size: 2.5rem; font-weight: 700;">${totalUsers}</div>
                            <div style="color: rgba(255,255,255,0.8); font-size: 0.9rem;">+${newUsers} за неделю</div>
                        </div>
                    </div>
                </div>
                
                <div class="stat-card" style="background: linear-gradient(135deg, #57F287, #4ad477); padding: 25px; border-radius: 16px;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-shopping-cart" style="font-size: 1.5rem; color: #1e1f29;"></i>
                        </div>
                        <div>
                            <div style="color: #1e1f29; font-size: 0.9rem;">Всего заказов</div>
                            <div style="color: #1e1f29; font-size: 2.5rem; font-weight: 700;">${totalOrders}</div>
                            <div style="color: #1e1f29; font-size: 0.9rem;">+${newOrders} за неделю</div>
                        </div>
                    </div>
                </div>
                
                <div class="stat-card" style="background: linear-gradient(135deg, #FEE75C, #e6d048); padding: 25px; border-radius: 16px;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="width: 50px; height: 50px; background: rgba(30,31,41,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-coins" style="font-size: 1.5rem; color: #1e1f29;"></i>
                        </div>
                        <div>
                            <div style="color: #1e1f29; font-size: 0.9rem;">Общая выручка</div>
                            <div style="color: #1e1f29; font-size: 2.5rem; font-weight: 700;">${revenue.toLocaleString('ru-RU')} ₽</div>
                            <div style="color: #1e1f29; font-size: 0.9rem;">Ср. чек: ${stats.avgOrderValue || 0} ₽</div>
                        </div>
                    </div>
                </div>
                
                <div class="stat-card" style="background: linear-gradient(135deg, #9B59B6, #8E44AD); padding: 25px; border-radius: 16px;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-chart-line" style="font-size: 1.5rem; color: white;"></i>
                        </div>
                        <div>
                            <div style="color: rgba(255,255,255,0.8); font-size: 0.9rem;">Конверсия</div>
                            <div style="color: white; font-size: 2.5rem; font-weight: 700;">${conversion}%</div>
                            <div style="color: rgba(255,255,255,0.8); font-size: 0.9rem;">${stats.totalOrders} заказов</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Детальная статистика -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 30px;">
                <div style="background: #2a2b36; border-radius: 16px; padding: 20px; border: 1px solid #40444b;">
                    <h3 style="color: white; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-chart-pie" style="color: #5865F2;"></i>
                        Детальная статистика
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 15px;">
                        <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid #40444b;">
                            <span style="color: #b9bbbe;">Заказов на пользователя</span>
                            <span style="color: #57F287; font-weight: 600;">${totalUsers > 0 ? (totalOrders / totalUsers).toFixed(2) : 0}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid #40444b;">
                            <span style="color: #b9bbbe;">Выручка на пользователя</span>
                            <span style="color: #57F287; font-weight: 600;">${totalUsers > 0 ? Math.round(revenue / totalUsers) : 0} ₽</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid #40444b;">
                            <span style="color: #b9bbbe;">Выручка на заказ</span>
                            <span style="color: #57F287; font-weight: 600;">${totalOrders > 0 ? Math.round(revenue / totalOrders) : 0} ₽</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #b9bbbe;">Процент покупателей</span>
                            <span style="color: #57F287; font-weight: 600;">${totalUsers > 0 ? Math.round((totalOrders / totalUsers) * 100) : 0}%</span>
                        </div>
                    </div>
                </div>
                
                <div style="background: #2a2b36; border-radius: 16px; padding: 20px; border: 1px solid #40444b;">
                    <h3 style="color: white; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-calendar" style="color: #5865F2;"></i>
                        Последние обновления
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 15px;">
                        <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid #40444b;">
                            <span style="color: #b9bbbe;">Последний заказ</span>
                            <span style="color: #b9bbbe;">${stats.lastOrderDate ? new Date(stats.lastOrderDate).toLocaleDateString('ru-RU') : 'Нет данных'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid #40444b;">
                            <span style="color: #b9bbbe;">Последний пользователь</span>
                            <span style="color: #b9bbbe;">${stats.lastUserDate ? new Date(stats.lastUserDate).toLocaleDateString('ru-RU') : 'Нет данных'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #b9bbbe;">Обновлено</span>
                            <span style="color: #b9bbbe;">${new Date().toLocaleString('ru-RU')}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Добавляем обработчик для чекбокса
        const toggleCheckbox = document.getElementById('shopClosedToggle');
        if (toggleCheckbox) {
            toggleCheckbox.addEventListener('change', (e) => {
                this.toggleShopClosed(e.target.checked);
            });
        }
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#57F287' : type === 'warning' ? '#FEE75C' : '#ED4245'};
            color: ${type === 'success' ? '#1e1f29' : type === 'warning' ? '#1e1f29' : 'white'};
            padding: 15px 25px;
            border-radius: 8px;
            z-index: 10001;
            min-width: 300px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideIn 0.3s ease;
        `;
        
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    static isShopClosed() {
        return localStorage.getItem('bhstore_shop_closed') === 'true';
    }
}

// Глобальная функция для проверки статуса магазина
window.isShopClosed = function() {
    return AdminStats.isShopClosed();
};

// Инициализация
window.AdminStats = AdminStats;
window.adminStats = new AdminStats();

// Глобальная функция
window.loadStats = async function() {
    await window.adminStats.loadStats();
};