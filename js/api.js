// api.js - ПОЛНАЯ И ЗАВЕРШЕННАЯ ВЕРСИЯ
class BHStoreAPI {
    constructor() {
        this.baseUrl = 'https://bhstore.netlify.app';
        this.authData = this.getAuthData();
        console.log('✅ BHStoreAPI инициализирован с baseUrl:', this.baseUrl);
    }

    getAuthData() {
        try {
            return JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        } catch (error) {
            console.error('❌ Ошибка парсинга auth данных:', error);
            return {};
        }
    }

    async request(endpoint, options = {}) {
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const url = `${this.baseUrl}/api${cleanEndpoint}`;

        const authData = this.getAuthData();
        const defaultHeaders = {
            'Content-Type': 'application/json',
            ...(authData.token && { 'Authorization': `Bearer ${authData.token}` })
        };

        try {
            console.log(`📡 ${options.method || 'GET'} ${url}`);
            const response = await fetch(url, {
                ...options,
                headers: { ...defaultHeaders, ...options.headers }
            });

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
                console.error('❌ Сервер вернул HTML вместо JSON:', url);
                const html = await response.text();
                console.error('HTML preview:', html.substring(0, 200));
                throw new Error('Сервер вернул HTML. Проверьте настройки Netlify Functions');
            }

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
            return data;
        } catch (error) {
            console.error(`❌ Ошибка API (${url}):`, error);
            throw error;
        }
    }

    // ========== АВТОРИЗАЦИЯ И АДМИН ==========
    async isAdmin() {
        try {
            const data = await this.request('/admin/check');
            return data.isAdmin === true;
        } catch { return false; }
    }
    async checkAdminStatus() {
        try {
            const data = await this.request('/user/me');
            return { isAdmin: data.user?.badges?.admin === true, isLoggedIn: true, user: data.user };
        } catch { return { isAdmin: false, isLoggedIn: false }; }
    }

    // ========== ПОЛЬЗОВАТЕЛИ ==========
    async getUser(userId) { return this.request(`/user/${userId}`); }
    async getUserBalance(userId) { return this.request(`/user/${userId}/balance`); }
    async getUserOrders(userId) { return this.request(`/user/${userId}/orders`); }
    async getAllUsers() { return this.request('/admin/users'); }
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

    // ========== ЧАТ ==========
    async getChatUsers() { return this.request('/admin/chat/users'); }
    async checkAdminMessages() {
        return this.request('/chat/admin/check', {
            method: 'POST',
            body: JSON.stringify({ lastChecked: Date.now() })
        });
    }
    async markMessagesAsRead(userId) {
        return this.request(`/chat/admin/mark-read/${userId}`, { method: 'POST' });
    }
    async sendChatMessage(userId, message, fromAdmin = false) {
        return this.request('/chat/send', {
            method: 'POST',
            body: JSON.stringify({ userId, message, fromAdmin })
        });
    }
    async getChatMessages(userId) { return this.request(`/chat/messages/${userId}`); }
    async checkNewMessages(userId, lastChecked) {
        return this.request('/chat/check', {
            method: 'POST',
            body: JSON.stringify({ userId, lastChecked })
        });
    }

    // ========== ПРОМОКОДЫ ==========
    async getUserPromocodes(userId) { return this.request(`/promocodes/user/${userId}`); }
    async getActivePromocodes(userId) { return this.request(`/promocodes/active/${userId}`); }
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

    // ========== ТОВАРЫ ==========
    async getProducts() { return this.request('/products'); }
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
        return this.request(`/admin/products/${productId}`, { method: 'DELETE' });
    }

    // ========== НОВОСТИ ==========
    async getNews() { return this.request('/news'); }

    // ========== ОТЗЫВЫ ==========
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
        return this.request(`/reviews/${reviewId}/helpful`, { method: 'POST' });
    }

    // ========== СТАТИСТИКА ==========
    async getStats() { return this.request('/admin/stats'); }

    // ========== УВЕДОМЛЕНИЯ ==========
    async getUserNotifications(userId) { return this.request(`/notifications/user/${userId}`); }
    async markNotificationRead(notificationId) {
        return this.request(`/notifications/${notificationId}/read`, { method: 'POST' });
    }

    // ========== ЗАКАЗЫ ==========
    async getAllOrders() { return this.request('/admin/orders'); }
    async createOrder(orderData) {
        return this.request('/create-order', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
    }

    // ========== УТИЛИТЫ ==========
    setAuthToken(token) {
        const authData = this.getAuthData();
        authData.token = token;
        localStorage.setItem('bhstore_auth', JSON.stringify(authData));
        this.authData = authData;
    }
    setUserData(userData) {
        const authData = this.getAuthData();
        const updatedData = { ...authData, ...userData };
        localStorage.setItem('bhstore_auth', JSON.stringify(updatedData));
        this.authData = updatedData;
    }
    logout() {
        localStorage.removeItem('bhstore_auth');
        localStorage.removeItem('bhstore_orders');
        localStorage.removeItem('bhstore_active_promocodes');
        window.location.href = '/';
    }
    formatError(error) { return error.message || 'Неизвестная ошибка'; }
}

const api = new BHStoreAPI();
window.BHStoreAPI = api;
window.api = api;
