class WebhookManager {
    constructor() {
        this.apiUrl = '/api';
        this.notifications = [];
        this.init();
    }

    init() {
        console.log('Webhook Manager инициализирован');
        this.loadNotificationsFromServer();
        
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }

    async loadNotificationsFromServer() {
        try {
            const token = localStorage.getItem('bhstore_token');
            if (!token) return;

            const response = await fetch(`${this.apiUrl}/notifications/user/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.notifications = data.notifications || [];
                this.displayNotifications();
            }
        } catch (error) {
            console.error('Ошибка загрузки уведомлений:', error);
        }
    }

    displayNotifications() {
        const notificationBadge = document.querySelector('.notification-badge');
        const notificationList = document.querySelector('.notification-list');
        
        if (notificationBadge) {
            const unreadCount = this.notifications.filter(n => !n.read).length;
            if (unreadCount > 0) {
                notificationBadge.textContent = unreadCount;
                notificationBadge.style.display = 'flex';
            } else {
                notificationBadge.style.display = 'none';
            }
        }
        
        if (notificationList) {
            this.renderNotificationList(notificationList);
        }
    }

    renderNotificationList(container) {
        if (this.notifications.length === 0) {
            container.innerHTML = '<div class="notification-empty">Нет уведомлений</div>';
            return;
        }
        
        const html = this.notifications.map(notif => `
            <div class="notification-item ${notif.read ? '' : 'unread'}" data-id="${notif.id}">
                <div class="notification-icon">${this.getNotificationIcon(notif.type)}</div>
                <div class="notification-content">
                    <div class="notification-title">${notif.title}</div>
                    <div class="notification-message">${notif.message}</div>
                    <div class="notification-time">${this.formatTime(notif.created_at)}</div>
                </div>
                ${!notif.read ? '<div class="notification-dot"></div>' : ''}
            </div>
        `).join('');
        
        container.innerHTML = html;
        
        container.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', () => this.markAsRead(item.dataset.id));
        });
    }

    getNotificationIcon(type) {
        const icons = {
            'purchase': '💰',
            'registration': '🎉',
            'message': '💬',
            'promocode': '🎫',
            'system': '🔔',
            'error': '⚠️',
            'warning': '⚡'
        };
        return icons[type] || '📌';
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'только что';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
        
        return date.toLocaleDateString('ru-RU', { 
            day: '2-digit', 
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    async sendDiscordNotification(title, description, color = 0x5865F2, fields = []) {
        try {
            const token = localStorage.getItem('bhstore_token');
            
            const response = await fetch(`${this.apiUrl}/webhook/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                    title,
                    description,
                    color,
                    fields
                })
            });

            if (response.ok) {
                console.log('✅ Уведомление отправлено в Discord');
                return true;
            } else {
                const error = await response.json();
                console.error('❌ Ошибка отправки уведомления:', error);
                return false;
            }
        } catch (error) {
            console.error('❌ Ошибка отправки вебхука:', error);
            return false;
        }
    }

    async sendPurchaseNotification(userId, productName, amount, orderId, username = '') {
        try {
            const token = localStorage.getItem('bhstore_token');
            
            await fetch(`${this.apiUrl}/notifications/purchase`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    userId,
                    productName,
                    amount,
                    orderId
                })
            });

            this.addLocalNotification({
                id: `local_${Date.now()}`,
                type: 'purchase',
                title: 'Новая покупка',
                message: `Вы купили ${productName} за ${amount} ₽`,
                created_at: new Date().toISOString()
            });

            return await this.sendDiscordNotification(
                '<:Price:1474932616523415583> Новая покупка!',
                `<:User:1474931634804359433> **${username || userId}** совершил покупку`,
                0x57F287,
                [
                    { name: '<:Shop:1474931641158860800> Товар', value: productName, inline: true },
                    { name: '<:Money:1474931656610811966> Сумма', value: `${amount} ₽`, inline: true },
                    { name: '<:id:1474931621621600256> Номер заказа', value: orderId, inline: false }
                ]
            );
        } catch (error) {
            console.error('❌ Ошибка отправки уведомления о покупке:', error);
            return false;
        }
    }

    async sendRegistrationNotification(userId, username) {
        try {
            const token = localStorage.getItem('bhstore_token');
            
            await fetch(`${this.apiUrl}/notifications/registration`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    userId,
                    username
                })
            });

            this.addLocalNotification({
                id: `local_${Date.now()}`,
                type: 'registration',
                title: 'Добро пожаловать!',
                message: `${username}, вы успешно зарегистрировались в BHStore`,
                created_at: new Date().toISOString()
            });

            return await this.sendDiscordNotification(
                '<:Yes:1474931426951430225> Новый пользователь!',
                `<:User:1474931634804359433> **${username}** зарегистрировался на сайте`,
                0x57F287,
                [
                    { name: '<:id:1474931621621600256> Discord ID', value: userId, inline: true },
                    { name: '<:Calendar:1474931438639841280> Дата', value: new Date().toLocaleDateString('ru-RU'), inline: true }
                ]
            );
        } catch (error) {
            console.error('❌ Ошибка отправки уведомления о регистрации:', error);
            return false;
        }
    }

    async sendErrorNotification(errorType, errorMessage, userId = null) {
        try {
            const token = localStorage.getItem('bhstore_token');
            
            await fetch(`${this.apiUrl}/notifications/error`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                    errorType,
                    errorMessage,
                    userId,
                    userAgent: navigator.userAgent,
                    url: window.location.href
                })
            });

            const fields = [
                { name: '⚡ Тип ошибки', value: errorType, inline: true },
                { name: '📝 Сообщение', value: errorMessage.substring(0, 1000), inline: false },
                { name: '🔗 URL', value: window.location.href, inline: false }
            ];

            if (userId) {
                fields.push({ name: '👤 Пользователь', value: `<@${userId}>`, inline: true });
            }

            return await this.sendDiscordNotification(
                '<:No:1474931420127756288> Ошибка на сайте',
                'Произошла ошибка в работе сайта',
                0xED4245,
                fields
            );
        } catch (error) {
            console.error('❌ Ошибка отправки уведомления об ошибке:', error);
            return false;
        }
    }

    async sendPromocodeNotification(userId, code, type, value) {
        try {
            return await this.sendDiscordNotification(
                '<:Yes:1474931426951430225> Промокод активирован',
                `<:User:1474931634804359433> <@${userId}> активировал промокод`,
                0xFEE75C,
                [
                    { name: '<:Premium:1474931599622803628> Промокод', value: `\`${code}\``, inline: true },
                    { name: '📊 Тип', value: type === 'discount' ? 'Скидка' : 'Пополнение', inline: true },
                    { name: '💰 Значение', value: type === 'discount' ? `${value}%` : `${value} ₽`, inline: true }
                ]
            );
        } catch (error) {
            console.error('❌ Ошибка отправки уведомления о промокоде:', error);
            return false;
        }
    }

    async sendAdminNotification(title, message, userId = null) {
        try {
            const fields = [
                { name: '📝 Сообщение', value: message, inline: false },
                { name: '⏰ Время', value: new Date().toLocaleString('ru-RU'), inline: true }
            ];

            if (userId) {
                fields.push({ name: '👤 Пользователь', value: `<@${userId}>`, inline: true });
            }

            return await this.sendDiscordNotification(
                `🔔 ${title}`,
                'Административное уведомление',
                0xFEE75C,
                fields
            );
        } catch (error) {
            console.error('❌ Ошибка отправки админ уведомления:', error);
            return false;
        }
    }

    async sendStats(stats) {
        try {
            const token = localStorage.getItem('bhstore_token');
            
            await fetch(`${this.apiUrl}/stats/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(stats)
            });

            const fields = [
                { name: '👥 Всего пользователей', value: stats.totalUsers?.toString() || '0', inline: true },
                { name: '✨ Новые пользователи', value: stats.newUsers?.toString() || '0', inline: true },
                { name: '📦 Всего заказов', value: stats.totalOrders?.toString() || '0', inline: true },
                { name: '🆕 Новые заказы', value: stats.newOrders?.toString() || '0', inline: true },
                { name: '💰 Выручка', value: `${stats.revenue || 0} ₽`, inline: true },
                { name: '📈 Конверсия', value: `${stats.conversion || 0}%`, inline: true },
                { name: '💳 Средний чек', value: `${stats.avgOrderValue || 0} ₽`, inline: true }
            ];

            return await this.sendDiscordNotification(
                '<:Stat:1474931447731322880> Статистика магазина',
                'Ежедневная статистика работы BHStore',
                0x5865F2,
                fields
            );
        } catch (error) {
            console.error('❌ Ошибка отправки статистики:', error);
            return false;
        }
    }

    async getUserNotifications() {
        try {
            const token = localStorage.getItem('bhstore_token');
            if (!token) return [];
            
            const response = await fetch(`${this.apiUrl}/notifications/user/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.notifications = data.notifications || [];
                this.displayNotifications();
                return this.notifications;
            }
        } catch (error) {
            console.error('❌ Ошибка получения уведомлений:', error);
        }
        return [];
    }

    addLocalNotification(notification) {
        this.notifications.unshift(notification);
        this.displayNotifications();
        
        this.showBrowserNotification(notification);
    }

    async markAsRead(notificationId) {
        try {
            const token = localStorage.getItem('bhstore_token');
            
            await fetch(`${this.apiUrl}/notifications/${notificationId}/read`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const notification = this.notifications.find(n => n.id === notificationId);
            if (notification) {
                notification.read = true;
                this.displayNotifications();
            }
        } catch (error) {
            console.error('❌ Ошибка отметки уведомления:', error);
        }
    }

    async markAllAsRead() {
        try {
            const token = localStorage.getItem('bhstore_token');
            
            await fetch(`${this.apiUrl}/notifications/mark-all-read`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            this.notifications.forEach(n => n.read = true);
            this.displayNotifications();
        } catch (error) {
            console.error('❌ Ошибка отметки всех уведомлений:', error);
        }
    }

    showBrowserNotification(notification) {
        if (!("Notification" in window)) {
            return;
        }

        if (Notification.permission === "granted") {
            const title = notification.fromAdmin ? '💬 Сообщение от администратора' : '🔔 BHStore';
            new Notification(title, {
                body: notification.message?.substring(0, 100) || notification.title || 'Новое уведомление',
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: notification.id,
                requireInteraction: notification.fromAdmin || false
            });
        }
    }

    async checkNewMessages() {
        try {
            const token = localStorage.getItem('bhstore_token');
            if (!token) return;

            const response = await fetch(`${this.apiUrl}/chat/admin/check`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                
                const adminChatBadge = document.querySelector('.admin-chat-badge');
                if (adminChatBadge) {
                    const totalUnread = data.totalUnread || 0;
                    if (totalUnread > 0) {
                        adminChatBadge.textContent = totalUnread;
                        adminChatBadge.style.display = 'flex';
                    } else {
                        adminChatBadge.style.display = 'none';
                    }
                }
            }
        } catch (error) {
            console.error('❌ Ошибка проверки новых сообщений:', error);
        }
    }

    startPolling(interval = 30000) {
        this.pollingInterval = setInterval(() => {
            this.getUserNotifications();
            this.checkNewMessages();
        }, interval);
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.webhookManager = new WebhookManager();
    window.webhookManager.startPolling(30000);
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebhookManager;
}