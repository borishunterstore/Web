// api.js - Исправленная версия
class BHStoreAPI {
    constructor() {
        this.baseUrl = 'https://bhstore.netlify.app/.netlify/functions/server';
        this.authData = this.getAuthData();
        console.log('✅ BHStoreAPI initialized with baseUrl:', this.baseUrl);
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
        // Убираем лишний /api если он есть в начале endpoint
        const cleanEndpoint = endpoint.startsWith('/api/') ? endpoint.substring(4) : endpoint;
        const url = `${this.baseUrl}${cleanEndpoint}`;
        
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
                const data = await this.request('/admin/check');
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
                const data = await this.request('/user/me');
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
        return this.request('/admin/chat/users');
    }

    async checkAdminMessages() {
        return this.request('/chat/admin/check', {
            method: 'POST',
            body: JSON.stringify({ lastChecked: Date.now() })
        });
    }

    async markMessagesAsRead(userId) {
        return this.request(`/chat/admin/mark-read/${userId}`, {
            method: 'POST'
        });
    }

    async sendChatMessage(userId, message, fromAdmin = false) {
        return this.request('/chat/send', {
            method: 'POST',
            body: JSON.stringify({ userId, message, fromAdmin })
        });
    }

    async getChatMessages(userId) {
        return this.request(`/chat/messages/${userId}`);
    }

    async checkNewMessages(userId, lastChecked) {
        return this.request('/chat/check', {
            method: 'POST',
            body: JSON.stringify({ userId, lastChecked })
        });
    }

    async getUserChat(userId) {
        return this.request(`/admin/chat/${userId}`);
    }

    async sendMessageToUser(userId, message) {
        return this.request('/admin/send-message', {
            method: 'POST',
            body: JSON.stringify({ userId, message })
        });
    }

    // ========== Управление пользователями ==========

    async getAllUsers() {
        return this.request('/admin/users');
    }

    async getUser(userId) {
        return this.request(`/user/${userId}`);
    }

    async getUserBalance(userId) {
        return this.request(`/user/${userId}/balance`);
    }

    async addUserBalance(userId, amount, reason) {
        return this.request('/admin/balance/add', {
            method: 'POST',
            body: JSON.stringify({ userId, amount, reason })
        });
    }

    async removeUserBalance(userId, amount, reason) {
        return this.request('/admin/balance/remove', {
            method: 'POST',
            body: JSON.stringify({ userId, amount, reason })
        });
    }

    async setUserBalance(userId, newBalance, reason) {
        return this.request('/admin/balance/set', {
            method: 'POST',
            body: JSON.stringify({ userId, newBalance, reason })
        });
    }

    async getUserBalanceHistory(userId) {
        return this.request(`/admin/balance/history/${userId}`);
    }

    // ========== Управление заказами ==========

    async getAllOrders() {
        return this.request('/admin/orders');
    }

    async createOrder(orderData) {
        return this.request('/create-order', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
    }

    async createOrderWithBalance(orderData) {
        return this.request('/create-order-balance', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
    }

    // ========== Управление товарами ==========

    async getProducts() {
        return this.request('/products');
    }

    async createProduct(productData) {
        return this.request('/admin/products', {
            method: 'POST',
            body: JSON.stringify(productData)
        });
    }

    async updateProduct(productId, productData) {
        return this.request(`/admin/products/${productId}`, {
            method: 'PUT',
            body: JSON.stringify(productData)
        });
    }

    async deleteProduct(productId) {
        return this.request(`/admin/products/${productId}`, {
            method: 'DELETE'
        });
    }

    // ========== Новости ==========

    async getNews() {
        return this.request('/news');
    }

    // ========== Статистика ==========

    async getStats() {
        return this.request('/admin/stats');
    }

    // ========== Промокоды ==========

    async getUserPromocodes(userId) {
        return this.request(`/promocodes/user/${userId}`);
    }

    async getActivePromocodes(userId) {
        return this.request(`/promocodes/active/${userId}`);
    }

    async checkPromocode(userId, code) {
        return this.request('/promocodes/check', {
            method: 'POST',
            body: JSON.stringify({ userId, code })
        });
    }

    async activatePromocode(userId, code) {
        return this.request('/promocodes/activate', {
            method: 'POST',
            body: JSON.stringify({ userId, code })
        });
    }

    async saveActivePromocodes(userId, activeDiscounts) {
        return this.request('/promocodes/save-active', {
            method: 'POST',
            body: JSON.stringify({ userId, activeDiscounts })
        });
    }

    async removeActivePromocode(userId, code) {
        return this.request('/promocodes/remove-active', {
            method: 'POST',
            body: JSON.stringify({ userId, code })
        });
    }

    // ========== Отзывы ==========

    async getReviews(page = 1, limit = 10) {
        return this.request(`/reviews?page=${page}&limit=${limit}`);
    }

    async createReview(reviewData) {
        return this.request('/reviews', {
            method: 'POST',
            body: JSON.stringify(reviewData)
        });
    }

    async markReviewHelpful(reviewId) {
        return this.request(`/reviews/${reviewId}/helpful`, {
            method: 'POST'
        });
    }

    // ========== Уведомления ==========

    async getUserNotifications(userId) {
        return this.request(`/notifications/user/${userId}`);
    }

    async markNotificationRead(notificationId) {
        return this.request(`/notifications/${notificationId}/read`, {
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
        if (error.message) {
            return error.message;
        }
        return 'Неизвестная ошибка';
    }
}

// Создаем и экспортируем экземпляр
const api = new BHStoreAPI();
window.BHStoreAPI = api;
window.api = api;

console.log('✅ BHStoreAPI готов к работе (исправленная версия без /api в путях)');