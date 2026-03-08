// api.js - ПОЛНАЯ ВЕРСИЯ
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

    // ========== ЧАТ МЕТОДЫ (ДЛЯ АДМИНКИ) ==========
    async getChatUsers() {
        const authData = this.getAuthData();
        const response = await fetch(`${this.baseUrl}/api/admin/chat/users`, {
            headers: {
                'Authorization': `Bearer ${authData.token || ''}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
    }

    async getChatMessages(userId) {
        const authData = this.getAuthData();
        const response = await fetch(`${this.baseUrl}/api/chat/messages/${userId}`, {
            headers: {
                'Authorization': `Bearer ${authData.token || ''}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
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
            throw new Error(`HTTP ${response.status}`);
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

    async getUserBalanceHistory(userId) {
        const authData = this.getAuthData();
        const response = await fetch(`${this.baseUrl}/api/admin/balance-history/${userId}`, {
            headers: {
                'Authorization': `Bearer ${authData.token || ''}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
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

    // ========== СТАТИСТИКА ==========
    async getStats() { 
        return this.request('/admin/stats'); 
    }

    // ========== УТИЛИТЫ ==========
    setAuthToken(token) {
        const authData = this.getAuthData();
        authData.token = token;
        localStorage.setItem('bhstore_auth', JSON.stringify(authData));
        this.authData = authData;
    }
}

// Создаем глобальный экземпляр
const api = new BHStoreAPI();
window.BHStoreAPI = BHStoreAPI;
window.api = api;