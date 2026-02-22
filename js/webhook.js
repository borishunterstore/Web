// js/webhook.js - Обработка вебхуков и уведомлений
class WebhookManager {
    constructor() {
        this.webhookUrl = 'https://discord.com/api/webhooks/1459512369960194260/mtTCwjsSXA2_I7H-zmVbsYd5erD3UZCD9fZ2EiZkVg2KLt-IENQutfE4y393vXY5ryzH';
        this.notifications = [];
        this.init();
    }

    init() {
        console.log('Webhook Manager инициализирован');
        this.loadNotifications();
    }

    // Отправка уведомления в Discord через вебхук
    async sendDiscordNotification(title, description, color = 0x5865F2, fields = []) {
        try {
            const embed = {
                title: title,
                description: description,
                color: color,
                timestamp: new Date().toISOString(),
                fields: fields
            };

            const response = await fetch(this.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ embeds: [embed] })
            });

            if (response.ok) {
                console.log('Уведомление отправлено в Discord');
                return true;
            } else {
                console.error('Ошибка отправки уведомления:', response.status);
                return false;
            }
        } catch (error) {
            console.error('Ошибка отправки вебхука:', error);
            return false;
        }
    }

    // Отправка уведомления о покупке
    async sendPurchaseNotification(userId, productName, amount, orderId) {
        return await this.sendDiscordNotification(
            '💰 Новая покупка!',
            `Пользователь <@${userId}> совершил покупку`,
            0x57F287,
            [
                { name: 'Товар', value: productName, inline: true },
                { name: 'Сумма', value: `${amount} ₽`, inline: true },
                { name: 'Номер заказа', value: orderId, inline: false }
            ]
        );
    }

    // Отправка уведомления о регистрации
    async sendRegistrationNotification(userId, username) {
        return await this.sendDiscordNotification(
            '🎉 Новый пользователь!',
            `Пользователь <@${userId}> (${username}) зарегистрировался на сайте`,
            0x57F287,
            [
                { name: 'Дата', value: new Date().toLocaleString('ru-RU'), inline: true },
                { name: 'Discord ID', value: userId, inline: true }
            ]
        );
    }

    // Отправка уведомления о проблеме
    async sendErrorNotification(errorType, errorMessage, userId = null) {
        const fields = [
            { name: 'Тип ошибки', value: errorType, inline: true },
            { name: 'Сообщение', value: errorMessage.substring(0, 1000), inline: false }
        ];

        if (userId) {
            fields.push({ name: 'Пользователь', value: `<@${userId}>`, inline: true });
        }

        return await this.sendDiscordNotification(
            '⚠️ Ошибка на сайте',
            'Произошла ошибка в работе сайта',
            0xED4245,
            fields
        );
    }

    // Отправка уведомления для админа
    async sendAdminNotification(title, message, userId = null) {
        const fields = [
            { name: 'Сообщение', value: message, inline: false }
        ];

        if (userId) {
            fields.push({ name: 'Пользователь', value: `<@${userId}>`, inline: true });
        }

        return await this.sendDiscordNotification(
            `🔔 ${title}`,
            'Административное уведомление',
            0xFEE75C,
            fields
        );
    }

    // Отправка сообщения пользователю через вебхук
    async sendUserMessage(userId, message, fromAdmin = false) {
        try {
            const embed = {
                title: fromAdmin ? '📨 Сообщение от администратора' : '📨 Новое сообщение',
                description: message,
                color: fromAdmin ? 0xFEE75C : 0x5865F2,
                timestamp: new Date().toISOString(),
                footer: {
                    text: fromAdmin ? 'BHStore - Поддержка' : 'BHStore - Магазин'
                }
            };

            // Можно использовать вебхук для отправки в отдельный канал поддержки
            // или интегрировать с ботом для отправки в ЛС
            const response = await fetch(this.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    content: `<@${userId}>`,
                    embeds: [embed]
                })
            });

            if (response.ok) {
                // Сохраняем уведомление локально
                this.saveNotification({
                    type: 'message_sent',
                    userId: userId,
                    message: message,
                    timestamp: new Date().toISOString(),
                    fromAdmin: fromAdmin
                });
                
                return true;
            } else {
                console.error('Ошибка отправки сообщения:', response.status);
                return false;
            }
        } catch (error) {
            console.error('Ошибка отправки сообщения:', error);
            return false;
        }
    }

    // Локальные уведомления
    saveNotification(notification) {
        this.notifications.unshift(notification);
        
        // Сохраняем в localStorage
        localStorage.setItem('bhstore_notifications', JSON.stringify(this.notifications.slice(0, 50)));
        
        // Показываем оповещение
        this.showBrowserNotification(notification);
    }

    loadNotifications() {
        try {
            const saved = localStorage.getItem('bhstore_notifications');
            if (saved) {
                this.notifications = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Ошибка загрузки уведомлений:', error);
        }
    }

    getNotifications() {
        return this.notifications;
    }

    clearNotifications() {
        this.notifications = [];
        localStorage.removeItem('bhstore_notifications');
    }

    showBrowserNotification(notification) {
        // Проверяем разрешение на уведомления
        if (!("Notification" in window)) {
            return;
        }

        // Запрашиваем разрешение если нужно
        if (Notification.permission === "default") {
            Notification.requestPermission();
        }

        // Показываем уведомление
        if (Notification.permission === "granted") {
            const title = notification.fromAdmin ? 'Сообщение от администратора' : 'BHStore';
            new Notification(title, {
                body: notification.message.substring(0, 100),
                icon: 'https://cdn.discordapp.com/embed/avatars/0.png'
            });
        }
    }

    // Отправка статистики
    async sendStats(stats) {
        return await this.sendDiscordNotification(
            '📊 Статистика магазина',
            'Ежедневная статистика работы магазина',
            0x5865F2,
            [
                { name: 'Всего пользователей', value: stats.totalUsers.toString(), inline: true },
                { name: 'Новые пользователи', value: stats.newUsers.toString(), inline: true },
                { name: 'Всего заказов', value: stats.totalOrders.toString(), inline: true },
                { name: 'Новые заказы', value: stats.newOrders.toString(), inline: true },
                { name: 'Выручка', value: `${stats.revenue} ₽`, inline: true },
                { name: 'Конверсия', value: `${stats.conversion}%`, inline: true }
            ]
        );
    }
}

// Экспорт глобального объекта
window.WebhookManager = WebhookManager;