// api.js - Исправленная версия
class BHStoreAPI {
    constructor() {
        this.baseUrl = 'https://bhstore.netlify.app';
        this.authData = this.getAuthData();
    }

    getAuthData() {
        try {
            return JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        } catch (error) {
            console.error('❌ Error parsing auth data:', error);
            return {};
        }
    }

    // ✅ Универсальный метод для запросов
    async request(endpoint, options = {}) {
        const authData = this.getAuthData();
        const url = `${this.baseUrl}${endpoint}`;
        
        const defaultHeaders = {
            'Content-Type': 'application/json',
            ...(authData.token && { 'Authorization': `Bearer ${authData.token}` })
        };

        try {
            console.log(`📡 ${options.method || 'GET'} ${url}`);
            
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...defaultHeaders,
                    ...options.headers
                }
            });

            // Проверяем на HTML ответ (ошибка)
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
                console.error('❌ Server returned HTML instead of JSON:', url);
                const html = await response.text();
                console.error('HTML preview:', html.substring(0, 200));
                throw new Error('Сервер вернул HTML. Проверьте настройки Netlify Functions');
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error(`❌ API Error (${url}):`, error);
            throw error;
        }
    }

    // ✅ Проверка админа через сервер
    async isAdmin() {
        try {
            const authData = this.getAuthData();
            
            // Локальная проверка для обратной совместимости
            const isAdminLocal = authData.username === 'borisonchik_yt' || 
                                authData.username === 'borisonchik' ||
                                authData.global_name === 'borisonchik_yt';
            
            if (!authData.token) return isAdminLocal;
            
            try {
                const data = await this.request('/api/admin/check');
                return data.isAdmin === true || isAdminLocal;
            } catch {
                return isAdminLocal;
            }
        } catch (error) {
            console.error('❌ Error checking admin status:', error);
            return false;
        }
    }

    // ✅ Проверка статуса пользователя
    async checkAdminStatus() {
        try {
            const authData = this.getAuthData();
            
            if (!authData.token && !authData.username) {
                return { isAdmin: false, isLoggedIn: false };
            }
            
            const isAdminLocal = authData.username === 'borisonchik_yt' || 
                                authData.username === 'borisonchik' ||
                                authData.global_name === 'borisonchik_yt';
            
            try {
                const data = await this.request('/api/user/me');
                return {
                    isAdmin: data.user?.badges?.admin === true || data.user?.badges?.partner === true || isAdminLocal,
                    isLoggedIn: true,
                    user: data.user
                };
            } catch {
                return {
                    isAdmin: isAdminLocal,
                    isLoggedIn: !!authData.username,
                    user: authData
                };
            }
        } catch (error) {
            console.error('❌ Error checking status:', error);
            return { isAdmin: false, isLoggedIn: false };
        }
    }

    // ========== Чат поддержки ==========
    
    async getChatUsers() {
        return this.request('/api/admin/chat/users');
    }

    async checkAdminMessages() {
        return this.request('/api/chat/admin/check', {
            method: 'POST',
            body: JSON.stringify({ lastChecked: Date.now() })
        });
    }

    async markMessagesAsRead(userId) {
        return this.request(`/api/chat/admin/mark-read/${userId}`, {
            method: 'POST'
        });
    }

    async sendChatMessage(userId, message, fromAdmin = false) {
        return this.request('/api/chat/send', {
            method: 'POST',
            body: JSON.stringify({ userId, message, fromAdmin })
        });
    }

    async getChatMessages(userId) {
        return this.request(`/api/chat/messages/${userId}`);
    }

    async checkNewMessages(userId, lastChecked) {
        return this.request('/api/chat/check', {
            method: 'POST',
            body: JSON.stringify({ userId, lastChecked })
        });
    }

    async getUserChat(userId) {
        return this.request(`/api/admin/chat/${userId}`);
    }

    async sendMessageToUser(userId, message) {
        return this.request('/api/admin/send-message', {
            method: 'POST',
            body: JSON.stringify({ userId, message })
        });
    }

    // ========== Управление пользователями ==========

    async getAllUsers() {
        return this.request('/api/admin/users');
    }

    async getUser(userId) {
        return this.request(`/api/user/${userId}`);
    }

    async getUserBalance(userId) {
        return this.request(`/api/user/${userId}/balance`);
    }

    async getUserOrders(userId) {
        return this.request(`/api/user/${userId}/orders`);
    }

    async addUserBalance(userId, amount, reason) {
        return this.request('/api/admin/balance/add', {
            method: 'POST',
            body: JSON.stringify({ userId, amount, reason })
        });
    }

    async removeUserBalance(userId, amount, reason) {
        return this.request('/api/admin/balance/remove', {
            method: 'POST',
            body: JSON.stringify({ userId, amount, reason })
        });
    }

    async setUserBalance(userId, newBalance, reason) {
        return this.request('/api/admin/balance/set', {
            method: 'POST',
            body: JSON.stringify({ userId, newBalance, reason })
        });
    }

    async getUserBalanceHistory(userId) {
        return this.request(`/api/admin/balance/history/${userId}`);
    }

    // ========== Управление заказами ==========

    async getAllOrders() {
        return this.request('/api/admin/orders');
    }

    async createOrder(orderData) {
        return this.request('/api/create-order', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
    }

    async createOrderWithBalance(orderData) {
        return this.request('/api/create-order-balance', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
    }

    // ========== Управление товарами ==========

    async getProducts() {
        return this.request('/api/products');
    }

    async createProduct(productData) {
        return this.request('/api/admin/products', {
            method: 'POST',
            body: JSON.stringify(productData)
        });
    }

    async updateProduct(productId, productData) {
        return this.request(`/api/admin/products/${productId}`, {
            method: 'PUT',
            body: JSON.stringify(productData)
        });
    }

    async deleteProduct(productId) {
        return this.request(`/api/admin/products/${productId}`, {
            method: 'DELETE'
        });
    }

    // ========== Новости ==========

    async getNews() {
        return this.request('/api/news');
    }

    // ========== Статистика ==========

    async getStats() {
        return this.request('/api/admin/stats');
    }

    // ========== Промокоды ==========

    async getUserPromocodes(userId) {
        return this.request(`/api/promocodes/user/${userId}`);
    }

    async getActivePromocodes(userId) {
        return this.request(`/api/promocodes/active/${userId}`);
    }

    async checkPromocode(userId, code) {
        return this.request('/api/promocodes/check', {
            method: 'POST',
            body: JSON.stringify({ userId, code })
        });
    }

    async activatePromocode(userId, code) {
        return this.request('/api/promocodes/activate', {
            method: 'POST',
            body: JSON.stringify({ userId, code })
        });
    }

    async saveActivePromocodes(userId, activeDiscounts) {
        return this.request('/api/promocodes/save-active', {
            method: 'POST',
            body: JSON.stringify({ userId, activeDiscounts })
        });
    }

    async removeActivePromocode(userId, code) {
        return this.request('/api/promocodes/remove-active', {
            method: 'POST',
            body: JSON.stringify({ userId, code })
        });
    }

    // ========== Отзывы ==========

    async getReviews(page = 1, limit = 10) {
        return this.request(`/api/reviews?page=${page}&limit=${limit}`);
    }

    async createReview(reviewData) {
        return this.request('/api/reviews', {
            method: 'POST',
            body: JSON.stringify(reviewData)
        });
    }

    async markReviewHelpful(reviewId) {
        return this.request(`/api/reviews/${reviewId}/helpful`, {
            method: 'POST'
        });
    }

    // ========== Уведомления ==========

    async getUserNotifications(userId) {
        return this.request(`/api/notifications/user/${userId}`);
    }

    async markNotificationRead(notificationId) {
        return this.request(`/api/notifications/${notificationId}/read`, {
            method: 'POST'
        });
    }

    // ========== Утилиты ==========

    // Сохранение токена после авторизации
    setAuthToken(token) {
        const authData = this.getAuthData();
        authData.token = token;
        localStorage.setItem('bhstore_auth', JSON.stringify(authData));
        this.authData = authData;
    }

    // Обновление данных пользователя
    setUserData(userData) {
        const authData = this.getAuthData();
        const updatedData = { ...authData, ...userData };
        localStorage.setItem('bhstore_auth', JSON.stringify(updatedData));
        this.authData = updatedData;
    }

    // Выход из системы
    logout() {
        localStorage.removeItem('bhstore_auth');
        localStorage.removeItem('bhstore_orders');
        localStorage.removeItem('bhstore_active_promocodes');
        window.location.href = '/';
    }

    // Форматирование ошибок
    formatError(error) {
        return error.message || 'Неизвестная ошибка';
    }
}

// Создаем и экспортируем экземпляр
const api = new BHStoreAPI();
window.BHStoreAPI = api;
window.api = api;