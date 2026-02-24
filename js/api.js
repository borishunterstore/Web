// api.js - Полная версия для работы с MongoDB на Netlify
class BHStoreAPI {
    constructor() {
        this.baseUrl = 'https://bhstore.netlify.app/.netlify/functions';
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

    // ✅ Проверка админа через сервер с MongoDB
    async isAdmin() {
        try {
            const authData = this.getAuthData();
            if (!authData.token) return false;
            
            const data = await this.request('/admin-check');
            return data.isAdmin === true;
        } catch (error) {
            console.error('❌ Error checking admin status:', error);
            return false;
        }
    }

    // ✅ Проверка статуса пользователя
    async checkAdminStatus() {
        try {
            const authData = this.getAuthData();
            if (!authData.token) {
                return { isAdmin: false, isLoggedIn: false };
            }
            
            const data = await this.request('/user-me');
            return {
                isAdmin: data.user?.badges?.admin === true || data.user?.badges?.partner === true,
                isLoggedIn: true,
                user: data.user
            };
        } catch (error) {
            console.error('❌ Error checking status:', error);
            return { isAdmin: false, isLoggedIn: false };
        }
    }

    // ========== Чат поддержки ==========
    
    async getChatUsers() {
        return this.request('/admin-chat-users');
    }

    async getChatMessages(userId) {
        return this.request(`/chat-messages/${userId}`);
    }

    async sendChatMessage(userId, message, fromAdmin = false) {
        return this.request('/chat-send', {
            method: 'POST',
            body: JSON.stringify({ userId, message, fromAdmin })
        });
    }

    async checkNewMessages(userId, lastChecked) {
        return this.request('/chat-check', {
            method: 'POST',
            body: JSON.stringify({ userId, lastChecked })
        });
    }

    async markMessagesAsRead(userId) {
        return this.request('/admin-mark-read', {
            method: 'POST',
            body: JSON.stringify({ userId })
        });
    }

    async checkAdminMessages() {
        return this.request('/admin-check-messages', {
            method: 'POST',
            body: JSON.stringify({ lastChecked: Date.now() })
        });
    }

    // ========== Управление пользователями ==========

    async getAllUsers() {
        return this.request('/admin-users');
    }

    async getUser(userId) {
        return this.request(`/user/${userId}`);
    }

    async getCurrentUser() {
        return this.request('/user-me');
    }

    async getUserBalance(userId) {
        return this.request(`/user-balance/${userId}`);
    }

    async addUserBalance(userId, amount, reason) {
        return this.request('/admin-balance-add', {
            method: 'POST',
            body: JSON.stringify({ userId, amount, reason })
        });
    }

    async removeUserBalance(userId, amount, reason) {
        return this.request('/admin-balance-remove', {
            method: 'POST',
            body: JSON.stringify({ userId, amount, reason })
        });
    }

    async setUserBalance(userId, newBalance, reason) {
        return this.request('/admin-balance-set', {
            method: 'POST',
            body: JSON.stringify({ userId, newBalance, reason })
        });
    }

    async getUserBalanceHistory(userId) {
        return this.request(`/admin-balance-history/${userId}`);
    }

    // ========== Управление заказами ==========

    async getAllOrders() {
        return this.request('/admin-orders');
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

    async updateOrderStatus(orderId, status) {
        return this.request('/admin-update-order', {
            method: 'POST',
            body: JSON.stringify({ orderId, status })
        });
    }

    // ========== Управление товарами ==========

    async getProducts() {
        return this.request('/products');
    }

    async createProduct(productData) {
        return this.request('/admin-products', {
            method: 'POST',
            body: JSON.stringify(productData)
        });
    }

    async updateProduct(productId, productData) {
        return this.request(`/admin-products/${productId}`, {
            method: 'PUT',
            body: JSON.stringify(productData)
        });
    }

    async deleteProduct(productId) {
        return this.request(`/admin-products/${productId}`, {
            method: 'DELETE'
        });
    }

    // ========== Управление новостями ==========

    async getNews() {
        return this.request('/news');
    }

    async createNews(newsData) {
        return this.request('/admin-news', {
            method: 'POST',
            body: JSON.stringify(newsData)
        });
    }

    async updateNews(newsId, newsData) {
        return this.request(`/admin-news/${newsId}`, {
            method: 'PUT',
            body: JSON.stringify(newsData)
        });
    }

    async deleteNews(newsId) {
        return this.request(`/admin-news/${newsId}`, {
            method: 'DELETE'
        });
    }

    // ========== Управление отзывами ==========

    async getReviews() {
        return this.request('/reviews');
    }

    async addReview(reviewData) {
        return this.request('/reviews', {
            method: 'POST',
            body: JSON.stringify(reviewData)
        });
    }

    async markReviewHelpful(reviewId, userId) {
        return this.request(`/reviews/${reviewId}/helpful`, {
            method: 'POST',
            body: JSON.stringify({ userId })
        });
    }

    async deleteReview(reviewId) {
        return this.request(`/admin-reviews/${reviewId}`, {
            method: 'DELETE'
        });
    }

    async addAdminReply(reviewId, reply) {
        return this.request(`/admin-reviews/${reviewId}/reply`, {
            method: 'POST',
            body: JSON.stringify({ reply })
        });
    }

    // ========== Управление промокодами ==========

    async checkPromocode(code, userId, productId = null) {
        return this.request('/promocode-check', {
            method: 'POST',
            body: JSON.stringify({ code, userId, productId })
        });
    }

    async activatePromocode(code, userId) {
        return this.request('/promocode-activate', {
            method: 'POST',
            body: JSON.stringify({ code, userId })
        });
    }

    async getUserPromocodes(userId) {
        return this.request(`/promocode-user/${userId}`);
    }

    async getAllPromocodes() {
        return this.request('/admin-promocodes');
    }

    async createPromocode(promocodeData) {
        return this.request('/admin-promocodes', {
            method: 'POST',
            body: JSON.stringify(promocodeData)
        });
    }

    async updatePromocode(code, promocodeData) {
        return this.request(`/admin-promocodes/${code}`, {
            method: 'PUT',
            body: JSON.stringify(promocodeData)
        });
    }

    async deletePromocode(code) {
        return this.request(`/admin-promocodes/${code}`, {
            method: 'DELETE'
        });
    }

    // ========== Статистика ==========

    async getStats() {
        return this.request('/admin-stats');
    }

    // ========== Discord OAuth ==========

    async discordAuth(code) {
        return this.request('/auth-discord', {
            method: 'POST',
            body: JSON.stringify({ code })
        });
    }

    async sendVerification(userId, code) {
        return this.request('/send-verification', {
            method: 'POST',
            body: JSON.stringify({ userId, code })
        });
    }

    async registerUser(userData) {
        return this.request('/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async sendWelcomeMessage(userId) {
        return this.request('/welcome-message', {
            method: 'POST',
            body: JSON.stringify({ userId })
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

console.log('✅ BHStoreAPI готов к работе с MongoDB');