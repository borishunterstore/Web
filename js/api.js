class BHStoreAPI {
    constructor() {
        this.baseUrl = '';
        this.authData = this.getAuthData();
    }

    getAuthData() {
        try {
            return JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        } catch (error) {
            return {};
        }
    }

    // ✅ Исправлено: проверка админа через сервер
    async isAdmin() {
        try {
            const authData = this.getAuthData();
            if (!authData.token) return false;
            
            // Проверяем через API, является ли пользователь админом
            const response = await fetch('/api/admin/check', {
                headers: {
                    'Authorization': `Bearer ${authData.token}`
                }
            });
            
            if (!response.ok) return false;
            
            const data = await response.json();
            return data.isAdmin === true;
            
        } catch (error) {
            console.error('Ошибка проверки прав администратора:', error);
            return false;
        }
    }

    // ✅ Новая функция для проверки статуса
    async checkAdminStatus() {
        try {
            const authData = this.getAuthData();
            if (!authData.token) {
                return { isAdmin: false, isLoggedIn: false };
            }
            
            const response = await fetch('/api/user/me', {
                headers: {
                    'Authorization': `Bearer ${authData.token}`
                }
            });
            
            if (!response.ok) {
                return { isAdmin: false, isLoggedIn: false };
            }
            
            const data = await response.json();
            return {
                isAdmin: data.user?.badges?.admin === true,
                isLoggedIn: true,
                user: data.user
            };
            
        } catch (error) {
            console.error('Ошибка проверки статуса:', error);
            return { isAdmin: false, isLoggedIn: false };
        }
    }

    async getChatUsers() {
        if (!await this.isAdmin()) {
            throw new Error('Требуются права администратора');
        }

        try {
            const response = await fetch('/api/chat/admin/users', {
                headers: {
                    'Authorization': `Bearer ${this.authData.token || ''}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения пользователей чата:', error);
            throw error;
        }
    }

    async checkAdminMessages() {
        if (!await this.isAdmin()) {
            throw new Error('Требуются права администратора');
        }

        try {
            const response = await fetch('/api/chat/admin/check', {
                headers: {
                    'Authorization': `Bearer ${this.authData.token || ''}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка проверки сообщений:', error);
            throw error;
        }
    }

    async markMessagesAsRead(userId) {
        if (!await this.isAdmin()) {
            throw new Error('Требуются права администратора');
        }

        try {
            const response = await fetch(`/api/chat/admin/mark-read/${userId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authData.token || ''}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка отметки сообщений:', error);
            throw error;
        }
    }

    async sendChatMessage(userId, message, fromAdmin = false) {
        try {
            const response = await fetch('/api/chat/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authData.token || ''}`
                },
                body: JSON.stringify({
                    userId: userId,
                    message: message,
                    fromAdmin: fromAdmin
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка отправки сообщения:', error);
            throw error;
        }
    }

    async getChatMessages(userId) {
        try {
            const response = await fetch(`/api/chat/messages/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${this.authData.token || ''}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения сообщений:', error);
            throw error;
        }
    }

    async getAllUsers() {
        if (!await this.isAdmin()) {
            throw new Error('Требуются права администратора');
        }

        try {
            const response = await fetch('/api/admin/users', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.authData.token || ''}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения пользователей:', error);
            throw error;
        }
    }

    async getUserBalance(userId) {
        try {
            const response = await fetch(`/api/user/${userId}/balance`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения баланса:', error);
            throw error;
        }
    }

    async addUserBalance(userId, amount, reason) {
        if (!await this.isAdmin()) {
            throw new Error('Требуются права администратора');
        }

        try {
            const response = await fetch('/api/admin/balance/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authData.token || ''}`
                },
                body: JSON.stringify({
                    userId: userId,
                    amount: amount,
                    reason: reason
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка пополнения баланса:', error);
            throw error;
        }
    }

    async removeUserBalance(userId, amount, reason) {
        if (!await this.isAdmin()) {
            throw new Error('Требуются права администратора');
        }

        try {
            const response = await fetch('/api/admin/balance/remove', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authData.token || ''}`
                },
                body: JSON.stringify({
                    userId: userId,
                    amount: amount,
                    reason: reason
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка списания баланса:', error);
            throw error;
        }
    }

    async setUserBalance(userId, newBalance, reason) {
        if (!await this.isAdmin()) {
            throw new Error('Требуются права администратора');
        }

        try {
            const response = await fetch('/api/admin/balance/set', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authData.token || ''}`
                },
                body: JSON.stringify({
                    userId: userId,
                    newBalance: newBalance,
                    reason: reason
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка установки баланса:', error);
            throw error;
        }
    }

    async getUserBalanceHistory(userId) {
        if (!await this.isAdmin()) {
            throw new Error('Требуются права администратора');
        }

        try {
            const response = await fetch(`/api/admin/balance/history/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${this.authData.token || ''}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения истории баланса:', error);
            throw error;
        }
    }

    async getAllOrders() {
        if (!await this.isAdmin()) {
            throw new Error('Требуются права администратора');
        }

        try {
            const response = await fetch('/api/admin/orders', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.authData.token || ''}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения заказов:', error);
            throw error;
        }
    }

    async sendMessageToUser(userId, message) {
        if (!await this.isAdmin()) {
            throw new Error('Требуются права администратора');
        }

        try {
            const response = await fetch('/api/admin/send-message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authData.token || ''}`
                },
                body: JSON.stringify({
                    userId: userId,
                    message: message
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка отправки сообщения:', error);
            throw error;
        }
    }

    async createProduct(productData) {
        if (!await this.isAdmin()) {
            throw new Error('Требуются права администратора');
        }

        try {
            const response = await fetch('/api/admin/products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authData.token || ''}`
                },
                body: JSON.stringify(productData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка создания товара:', error);
            throw error;
        }
    }

    async updateProduct(productId, productData) {
        if (!await this.isAdmin()) throw new Error('Требуются права администратора');
    
        try {
            const response = await fetch(`/api/admin/products/${productId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authData.token || ''}`
                },
                body: JSON.stringify(productData),
                signal: AbortSignal.timeout(8000) 
            });
    
            if (!response.ok) {
                const errorDetails = await response.json().catch(() => ({}));
                throw new Error(errorDetails.message || `Ошибка сервера: ${response.status}`);
            }
    
            return await response.json();
    
        } catch (error) {
            if (error.name === 'TimeoutError') {
                console.error('Запрос прерван по таймауту');
            } else {
                console.error('Ошибка обновления товара:', error.message);
            }
            throw error;
        }
    }

    async deleteProduct(productId) {
        if (!await this.isAdmin()) {
            throw new Error('Требуются права администратора');
        }

        try {
            const response = await fetch(`/api/admin/products/${productId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.authData.token || ''}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка удаления товара:', error);
            throw error;
        }
    }

    async getStats() {
        if (!await this.isAdmin()) {
            throw new Error('Требуются права администратора');
        }

        try {
            const response = await fetch('/api/admin/stats', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.authData.token || ''}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения статистики:', error);
            throw error;
        }
    }

    async getProducts() {
        try {
            const response = await fetch('/api/products');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения товаров:', error);
            throw error;
        }
    }

    async getNews() {
        try {
            const response = await fetch('/api/news');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения новостей:', error);
            throw error;
        }
    }

    async getUser(userId) {
        try {
            const response = await fetch(`/api/user/${userId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения пользователя:', error);
            throw error;
        }
    }

    async createOrder(orderData) {
        try {
            const response = await fetch('/api/create-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка создания заказа:', error);
            throw error;
        }
    }

    async logout() {
        localStorage.removeItem('bhstore_auth');
        window.location.href = '/';
    }
}

// Создаем глобальный экземпляр
window.BHStoreAPI = new BHStoreAPI();