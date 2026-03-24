// admin-stats.js - Статистика и настройки магазина
class AdminStats {
    constructor() {
        this.api = window.api; 
        this.baseUrl = 'https://bhstore.netlify.app/.netlify/functions';
        this.shopClosed = false;
        this.registrationEnabled = true;
        this.siteAccess = true;
    }

    // Получить токен авторизации
    getAuthToken() {
        try {
            const authData = JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
            return authData.token || null;
        } catch (error) {
            console.error('Ошибка получения токена:', error);
            return null;
        }
    }

    async loadStats() {
        try {
            const data = await this.api.getStats();
            await this.loadShopSettings();
            this.renderStats(data);
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
            this.showNotification(this.api.formatError(error), 'error');
        }
    }

    async loadShopSettings() {
        try {
            const response = await fetch('/api/shop-settings');
            const data = await response.json();
            
            if (data.success) {
                this.shopClosed = data.settings.shop_closed || false;
                this.registrationEnabled = data.settings.registration_enabled !== false;
                this.siteAccess = data.settings.site_access !== false;
                
                // Сохраняем в localStorage для синхронизации с фронтендом
                localStorage.setItem('bhstore_shop_closed', this.shopClosed);
                localStorage.setItem('bhstore_registration_enabled', this.registrationEnabled);
                localStorage.setitem('bhstore_site_access', this.siteAccess);
                
                // Обновляем чекбоксы
                const shopCheckbox = document.getElementById('shopClosedToggle');
                if (shopCheckbox) shopCheckbox.checked = this.shopClosed;
                
                const registrationCheckbox = document.getElementById('registrationEnabledToggle');
                if (registrationCheckbox) registrationCheckbox.checked = this.registrationEnabled;
                
                const siteAccessCheckbox = document.getElementById('siteAccessToggle');
                if (siteAccessCheckbox) siteAccessCheckbox.checked = this.siteAccess;
            }
        } catch (error) {
            console.error('Ошибка загрузки настроек:', error);
        }
    }

    async toggleShopClosed(closed) {
        const token = this.getAuthToken();
        
        if (!token) {
            this.showNotification('Ошибка авторизации. Пожалуйста, войдите заново.', 'error');
            const checkbox = document.getElementById('shopClosedToggle');
            if (checkbox) checkbox.checked = !closed;
            return;
        }
        
        try {
            const response = await fetch('/api/admin/shop-settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    setting_key: 'shop_closed',
                    setting_value: closed
                })
            });
            
            if (response.status === 401) {
                this.showNotification('Сессия истекла. Пожалуйста, войдите заново.', 'error');
                setTimeout(() => window.location.href = '/profile.html', 2000);
                return;
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.shopClosed = closed;
                localStorage.setItem('bhstore_shop_closed', closed);
                this.updateShopStatusDisplay(closed);
                this.showNotification(`Магазин ${closed ? 'закрыт' : 'открыт'}`, closed ? 'warning' : 'success');
            } else {
                throw new Error(result.error || 'Ошибка при изменении статуса');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            this.showNotification('Ошибка при изменении статуса: ' + error.message, 'error');
            const checkbox = document.getElementById('shopClosedToggle');
            if (checkbox) checkbox.checked = !closed;
        }
    }

    async toggleRegistration(enabled) {
        const token = this.getAuthToken();
        
        if (!token) {
            this.showNotification('Ошибка авторизации. Пожалуйста, войдите заново.', 'error');
            const checkbox = document.getElementById('registrationEnabledToggle');
            if (checkbox) checkbox.checked = !enabled;
            return;
        }
        
        try {
            const response = await fetch('/api/admin/shop-settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    setting_key: 'registration_enabled',
                    setting_value: enabled
                })
            });
            
            if (response.status === 401) {
                this.showNotification('Сессия истекла. Пожалуйста, войдите заново.', 'error');
                setTimeout(() => window.location.href = '/profile.html', 2000);
                return;
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.registrationEnabled = enabled;
                localStorage.setItem('bhstore_registration_enabled', enabled);
                this.showNotification(`Регистрация ${enabled ? 'включена' : 'отключена'}`, enabled ? 'success' : 'warning');
            } else {
                throw new Error(result.error || 'Ошибка при изменении статуса');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            this.showNotification('Ошибка при изменении статуса регистрации: ' + error.message, 'error');
            const checkbox = document.getElementById('registrationEnabledToggle');
            if (checkbox) checkbox.checked = !enabled;
        }
    }

    async toggleSiteAccess(enabled) {
        const token = this.getAuthToken();
        
        if (!token) {
            this.showNotification('Ошибка авторизации. Пожалуйста, войдите заново.', 'error');
            const checkbox = document.getElementById('siteAccessToggle');
            if (checkbox) checkbox.checked = !enabled;
            return;
        }
        
        try {
            const response = await fetch('/api/admin/shop-settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    setting_key: 'site_access',
                    setting_value: enabled
                })
            });
            
            if (response.status === 401) {
                this.showNotification('Сессия истекла. Пожалуйста, войдите заново.', 'error');
                setTimeout(() => window.location.href = '/profile.html', 2000);
                return;
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.siteAccess = enabled;
                localStorage.setItem('bhstore_site_access', enabled);
                this.showNotification(`Доступ к сайту ${enabled ? 'включен' : 'отключен'}`, enabled ? 'success' : 'warning');
            } else {
                throw new Error(result.error || 'Ошибка при изменении статуса');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            this.showNotification('Ошибка при изменении доступа: ' + error.message, 'error');
            const checkbox = document.getElementById('siteAccessToggle');
            if (checkbox) checkbox.checked = !enabled;
        }
    }

    updateShopStatusDisplay(closed) {
        const statusElement = document.getElementById('shopStatus');
        if (statusElement) {
            statusElement.innerHTML = closed 
                ? '<span style="color: #ED4245;"><i class="fas fa-ban"></i> Закрыт</span>'
                : '<span style="color: #57F287;"><i class="fas fa-check-circle"></i> Открыт</span>';
        }
        
        const borderElement = document.querySelector('.shop-settings-panel');
        if (borderElement) {
            borderElement.style.border = closed ? '2px solid #ED4245' : '2px solid #57F287';
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
            <div class="shop-settings-panel" style="background: linear-gradient(135deg, #2a2b36, #1e1f29); border-radius: 16px; padding: 25px; margin-bottom: 30px; border: 2px solid ${this.shopClosed ? '#ED4245' : '#57F287'};">
                <h3 style="color: white; margin-bottom: 20px;">
                    <i class="fas fa-cog"></i> Управление магазином
                </h3>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                    <!-- Настройка: Магазин -->
                    <div style="background: #202225; border-radius: 12px; padding: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <div>
                                <i class="fas fa-store" style="color: #5865F2;"></i>
                                <span style="color: white; margin-left: 8px;">Магазин</span>
                            </div>
                            <div id="shopStatus" style="font-size: 0.9rem;">
                                ${this.shopClosed ? '<span style="color: #ED4245;">❌ Закрыт</span>' : '<span style="color: #57F287;">✅ Открыт</span>'}
                            </div>
                        </div>
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; margin-top: 10px;">
                            <div class="toggle-switch">
                                <input type="checkbox" id="shopClosedToggle" ${this.shopClosed ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </div>
                            <span style="color: #b9bbbe;">Магазин закрыт</span>
                        </label>
                        <p style="color: #72767d; font-size: 0.8rem; margin-top: 10px;">
                            При закрытии обычные пользователи не видят товары
                        </p>
                    </div>
                    
                    <!-- Настройка: Регистрация -->
                    <div style="background: #202225; border-radius: 12px; padding: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <div>
                                <i class="fas fa-user-plus" style="color: #57F287;"></i>
                                <span style="color: white; margin-left: 8px;">Регистрация</span>
                            </div>
                            <div id="registrationStatus" style="font-size: 0.9rem;">
                                ${this.registrationEnabled ? '<span style="color: #57F287;">✅ Включена</span>' : '<span style="color: #ED4245;">❌ Отключена</span>'}
                            </div>
                        </div>
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; margin-top: 10px;">
                            <div class="toggle-switch">
                                <input type="checkbox" id="registrationEnabledToggle" ${this.registrationEnabled ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </div>
                            <span style="color: #b9bbbe;">Регистрация включена</span>
                        </label>
                        <p style="color: #72767d; font-size: 0.8rem; margin-top: 10px;">
                            Новые пользователи не смогут зарегистрироваться
                        </p>
                    </div>
                    
                    <!-- Настройка: Доступ к сайту -->
                    <div style="background: #202225; border-radius: 12px; padding: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <div>
                                <i class="fas fa-globe" style="color: #FEE75C;"></i>
                                <span style="color: white; margin-left: 8px;">Доступ к сайту</span>
                            </div>
                            <div id="siteAccessStatus" style="font-size: 0.9rem;">
                                ${this.siteAccess ? '<span style="color: #57F287;">✅ Включен</span>' : '<span style="color: #ED4245;">❌ Отключен</span>'}
                            </div>
                        </div>
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; margin-top: 10px;">
                            <div class="toggle-switch">
                                <input type="checkbox" id="siteAccessToggle" ${this.siteAccess ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </div>
                            <span style="color: #b9bbbe;">Доступ к сайту включен</span>
                        </label>
                        <p style="color: #72767d; font-size: 0.8rem; margin-top: 10px;">
                            Полная блокировка сайта для обычных пользователей
                        </p>
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

        // Добавляем обработчики для переключателей
        const shopToggle = document.getElementById('shopClosedToggle');
        if (shopToggle) {
            shopToggle.addEventListener('change', (e) => {
                this.toggleShopClosed(e.target.checked);
            });
        }
        
        const regToggle = document.getElementById('registrationEnabledToggle');
        if (regToggle) {
            regToggle.addEventListener('change', (e) => {
                this.toggleRegistration(e.target.checked);
            });
        }
        
        const siteToggle = document.getElementById('siteAccessToggle');
        if (siteToggle) {
            siteToggle.addEventListener('change', (e) => {
                this.toggleSiteAccess(e.target.checked);
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
}

// Инициализация
window.AdminStats = AdminStats;
window.adminStats = new AdminStats();

// Глобальная функция
window.loadStats = async function() {
    await window.adminStats.loadStats();
};