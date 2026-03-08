// api.js - ПОЛНАЯ ВЕРСИЯ СО ВСЕМИ МЕТОДАМИ
class BHStoreAPI {
    constructor() {
        this.baseUrl = 'https://bhstore.netlify.app';
        this.authData = this.getAuthData();
        console.log('✅ BHStoreAPI инициализирован');
    }

    getAuthData() {
        try {
            return JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        } catch {
            return {};
        }
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}/api${endpoint}`;
        const authData = this.getAuthData();
        
        const headers = {
            'Content-Type': 'application/json',
            ...(authData.token && { 'Authorization': `Bearer ${authData.token}` }),
            ...options.headers
        };

        try {
            console.log(`📡 ${options.method || 'GET'} ${url}`);
            const response = await fetch(url, { ...options, headers });
            
            if (!response.ok) {
                const text = await response.text();
                try {
                    const data = JSON.parse(text);
                    throw new Error(data.error || `HTTP ${response.status}`);
                } catch {
                    throw new Error(`HTTP ${response.status}`);
                }
            }
            
            return await response.json();
        } catch (error) {
            console.error(`❌ API Error ${url}:`, error);
            throw error;
        }
    }

    // ========== АДМИН ПРОВЕРКА ==========
    async isAdmin() {
        try {
            const data = await this.request('/admin/check');
            return data.isAdmin === true;
        } catch {
            return false;
        }
    }

    // ========== ПОЛЬЗОВАТЕЛИ (АДМИН) ==========
    async getAllUsers() {
        return this.request('/admin/users');
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
        return this.request(`/admin/balance-history/${userId}`);
    }

    // ========== ЗАКАЗЫ (АДМИН) ==========
    async getAllOrders() {
        return this.request('/admin/orders');
    }

    async updateOrderStatus(orderId, status) {
        return this.request('/admin-update-order', {
            method: 'POST',
            body: JSON.stringify({ orderId, status })
        });
    }

    // ========== ТОВАРЫ ==========
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

    // ========== ЧАТ МЕТОДЫ (ДЛЯ АДМИНКИ) ==========
    async getChatUsers() {
        return this.request('/admin/chat/users');
    }

    async getChatMessages(userId) {
        return this.request(`/chat/messages/${userId}`);
    }

    async sendChatMessage(userId, message, fromAdmin = false) {
        return this.request('/chat/send', {
            method: 'POST',
            body: JSON.stringify({ userId, message, fromAdmin })
        });
    }

    async checkNewMessages(userId, lastChecked) {
        return this.request('/chat/check', {
            method: 'POST',
            body: JSON.stringify({ userId, lastChecked })
        });
    }

    async markMessagesAsRead(userId) {
        return this.request(`/chat/mark-read/${userId}`, {
            method: 'POST'
        });
    }

    // ========== СТАТИСТИКА ==========
    async getStats() {
        return this.request('/admin/stats');
    }

    // ========== ПОЛЬЗОВАТЕЛЬ (ОБЩЕЕ) ==========
    async getUser(userId) {
        return this.request(`/user/${userId}`);
    }

    async getUserOrders(userId) {
        return this.request(`/user/${userId}/orders`);
    }

    // ========== ПРОМОКОДЫ ==========
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

    // ========== ЗАКАЗЫ (ПОЛЬЗОВАТЕЛЬ) ==========
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

    formatError(error) {
        return error.message || 'Неизвестная ошибка';
    }
}

// Создаем глобальный экземпляр
const api = new BHStoreAPI();
window.BHStoreAPI = BHStoreAPI;
window.api = api;