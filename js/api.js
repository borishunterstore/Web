// api.js - ПОЛНАЯ ВЕРСИЯ С МЕТОДАМИ ЧАТА
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

            if (!response.ok) {
                const text = await response.text();
                try {
                    const data = JSON.parse(text);
                    throw new Error(data.error || `HTTP ${response.status}`);
                } catch {
                    throw new Error(`HTTP ${response.status}: ${text.substring(0, 100)}`);
                }
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`❌ Ошибка API (${url}):`, error);
            throw error;
        }
    }

    // ========== ЧАТ МЕТОДЫ ==========
    async getChatMessages(userId) {
        const authData = this.getAuthData();
        const response = await fetch(`${this.baseUrl}/api/chat/messages/${userId}`, {
            headers: {
                'Authorization': `Bearer ${authData.token || ''}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Не удалось загрузить сообщения');
        }
        
        return await response.json();
    }

    async sendChatMessage(userId, message, fromAdmin = false) {
        const authData = this.getAuthData();
        const response = await fetch(`${this.baseUrl}/api/chat/send`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authData.token || ''}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId, message, fromAdmin })
        });
        
        if (!response.ok) {
            throw new Error('Не удалось отправить сообщение');
        }
        
        return await response.json();
    }

    async checkNewMessages(userId, lastChecked) {
        const authData = this.getAuthData();
        const response = await fetch(`${this.baseUrl}/api/chat/check`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authData.token || ''}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId, lastChecked })
        });
        
        if (!response.ok) {
            throw new Error('Не удалось проверить сообщения');
        }
        
        return await response.json();
    }

    async markMessagesAsRead(userId) {
        const authData = this.getAuthData();
        const response = await fetch(`${this.baseUrl}/api/chat/mark-read/${userId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authData.token || ''}`,
                'Content-Type': 'application/json'
            }
        });
        
        return await response.json();
    }

    // ========== ПОЛЬЗОВАТЕЛИ ==========
    async getUser(userId) { 
        return this.request(`/user/${userId}`); 
    }
    
    async getUserBalance(userId) { 
        return this.request(`/user/${userId}/balance`); 
    }
    
    async getUserOrders(userId) { 
        return this.request(`/user/${userId}/orders`); 
    }
    
    async getAllUsers() { 
        return this.request('/admin/users'); 
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

    // ========== ТОВАРЫ ==========
    async getProducts() { 
        return this.request('/products'); 
    }

    // ========== СТАТИСТИКА ==========
    async getStats() { 
        return this.request('/admin/stats'); 
    }

    // ========== ЗАКАЗЫ ==========
    async getAllOrders() { 
        return this.request('/admin/orders'); 
    }
    
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