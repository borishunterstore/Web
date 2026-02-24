// api.js - Полная версия для работы с Netlify Functions
class BHStoreAPI {
    constructor() {
        this.baseUrl = 'https://bhstore.netlify.app/.netlify/functions';
        this.authData = this.getAuthData();
    }

    getAuthData() {
        try {
            return JSON.parse(localStorage.getItem('bhstore_auth') || '{}');
        } catch (error) {
            console.error('Ошибка парсинга auth data:', error);
            return {};
        }
    }

    // ✅ Проверка админа через сервер
    async isAdmin() {
        try {
            const authData = this.getAuthData();
            if (!authData.token) return false;
            
            const response = await fetch(`${this.baseUrl}/admin-check`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authData.token}`,
                    'Content-Type': 'application/json'
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

    // ✅ Проверка статуса пользователя
    async checkAdminStatus() {
        try {
            const authData = this.getAuthData();
            if (!authData.token) {
                return { isAdmin: false, isLoggedIn: false };
            }
            
            const response = await fetch(`${this.baseUrl}/user-me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authData.token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                return { isAdmin: false, isLoggedIn: false };
            }
            
            const data = await response.json();
            return {
                isAdmin: data.user?.badges?.admin === true || data.user?.badges?.partner === true,
                isLoggedIn: true,
                user: data.user
            };
            
        } catch (error) {
            console.error('Ошибка проверки статуса:', error);
            return { isAdmin: false, isLoggedIn: false };
        }
    }

    // ✅ Получение пользователей чата (админ)
    async getChatUsers() {
        if (!await this.isAdmin()) {
            throw new Error('Требуются права администратора');
        }

        try {
            const response = await fetch(`${this.baseUrl}/admin-chat-users`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.authData.token || ''}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения пользователей чата:', error);
            throw error;
        }
    }

    // ✅ Проверка новых сообщений (админ)
    async checkAdminMessages() {
        if (!await this.isAdmin()) {
            throw new Error('Требуются права администратора');
        }

        try {
            const response = await fetch(`${this.baseUrl}/admin-check-messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authData.token || ''}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    lastChecked: Date.now()
                })
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка проверки сообщений:', error);
            throw error;
        }
    }

    // ✅ Отметка сообщений как прочитанных (админ)
    async markMessagesAsRead(userId) {
        if (!await this.isAdmin()) {
            throw new Error('Требуются права администратора');
        }

        try {
            const response = await fetch(`${this.baseUrl}/admin-mark-read`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authData.token || ''}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId })
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка отметки сообщений:', error);
            throw error;
        }
    }

    // ✅ Отправка сообщения в чат
    async sendChatMessage(userId, message, fromAdmin = false) {
        try {
            const response = await fetch(`${this.baseUrl}/chat-send`, {
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
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка отправки сообщения:', error);
            throw error;
        }
    }

    // ✅ Получение сообщений чата
    async getChatMessages(userId) {
        try {
            const response = await fetch(`${this.baseUrl}/chat-messages/${userId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.authData.token || ''}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения сообщений:', error);
            throw error;
        }
    }

    // ✅ Проверка новых сообщений для пользователя
    async checkNewMessages(userId, lastChecked) {
        try {
            const response = await fetch(`${this.baseUrl}/chat-check`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authData.token || ''}`
                },
                body: JSON.stringify({
                    userId,
                    lastChecked
                })
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка проверки сообщений:', error);
            throw error;
        }
    }

    // ✅ Получение всех пользователей (админ)
    async getAllUsers() {
        if (!await this.isAdmin()) {
            throw new Error('Требуются права администратора');
        }

        try {
            const response = await fetch(`${this.baseUrl}/admin-users`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.authData.token || ''}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения пользователей:', error);
            throw error;
        }
    }

    // ✅ Получение баланса пользователя
    async getUserBalance(userId) {
        try {
            const response = await fetch(`${this.baseUrl}/user-balance/${userId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения баланса:', error);
            throw error;
        }
    }

    // ✅ Пополнение баланса (админ)
    async addUserBalance(userId, amount, reason) {
        if (!await this.isAdmin()) {
            throw new Error('Требуются права администратора');
        }

        try {
            const response = await fetch(`${this.baseUrl}/admin-balance-add`, {
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
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка пополнения баланса:', error);
            throw error;
        }
    }

    // ✅ Списание баланса (админ)
    async removeUserBalance(userId, amount, reason) {
        if (!await this.isAdmin()) {
            throw new Error('Требуются права администратора');
        }

        try {
            const response = await fetch(`${this.baseUrl}/admin-balance-remove`, {
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
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка списания баланса:', error);
            throw error;
        }
    }

    // ✅ Установка баланса (админ)
    async setUserBalance(userId, newBalance, reason) {
        if (!await this.isAdmin()) {
            throw new Error('Требуются права администратора');
        }

        try {
            const response = await fetch(`${this.baseUrl}/admin-balance-set`, {
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
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка установки баланса:', error);
            throw error;
        }
    }

    // ✅ Получение истории баланса (админ)
    async getUserBalanceHistory(userId) {
        if (!await this.isAdmin()) {
            throw new Error('Требуются права администратора');
        }

        try {
            const response = await fetch(`${this.baseUrl}/admin-balance-history/${userId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.authData.token || ''}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения истории баланса:', error);
            throw error;
        }
    }

    // ✅ Получение всех заказов (админ)
    async getAllOrders() {
        if (!await this.isAdmin()) {
            throw new Error('Требуются права администратора');
        }

        try {
            const response = await fetch(`${this.baseUrl}/admin-orders`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.authData.token || ''}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения заказов:', error);
            throw error;
        }
    }

    // ✅ Отправка сообщения пользователю (админ)
    async sendMessageToUser(userId, message) {
        if (!await this.isAdmin()) {
            throw new Error('Требуются права администратора');
        }

        try {
            const response = await fetch(`${this.baseUrl}/admin-send-message`, {
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
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка отправки сообщения:', error);
            throw error;
        }
    }

    // ✅ Создание товара (админ)
    async createProduct(productData) {
        if (!await this.isAdmin()) {
            throw new Error('Требуются права администратора');
        }

        try {
            const response = await fetch(`${this.baseUrl}/admin-products`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authData.token || ''}`
                },
                body: JSON.stringify(productData)
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка создания товара:', error);
            throw error;
        }
    }

    // ✅ Обновление товара (админ)
    async updateProduct(productId, productData) {
        if (!await this.isAdmin()) throw new Error('Требуются права администратора');
    
        try {
            const response = await fetch(`${this.baseUrl}/admin-products/${productId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authData.token || ''}`
                },
                body: JSON.stringify(productData)
            });
    
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `Ошибка сервера: ${response.status}`);
            }
    
            return await response.json();
    
        } catch (error) {
            console.error('Ошибка обновления товара:', error.message);
            throw error;
        }
    }

    // ✅ Удаление товара (админ)
    async deleteProduct(productId) {
        if (!await this.isAdmin()) {
            throw new Error('Требуются права администратора');
        }

        try {
            const response = await fetch(`${this.baseUrl}/admin-products/${productId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.authData.token || ''}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка удаления товара:', error);
            throw error;
        }
    }

    // ✅ Получение статистики (админ)
    async getStats() {
        if (!await this.isAdmin()) {
            throw new Error('Требуются права администратора');
        }

        try {
            const response = await fetch(`${this.baseUrl}/admin-stats`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.authData.token || ''}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения статистики:', error);
            throw error;
        }
    }

    // ✅ Получение товаров
    async getProducts() {
        try {
            const response = await fetch(`${this.baseUrl}/products`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения товаров:', error);
            throw error;
        }
    }

    // ✅ Получение новостей
    async getNews() {
        try {
            const response = await fetch(`${this.baseUrl}/news`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения новостей:', error);
            throw error;
        }
    }

    // ✅ Получение пользователя
    async getUser(userId) {
        try {
            const response = await fetch(`${this.baseUrl}/user/${userId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения пользователя:', error);
            throw error;
        }
    }

    // ✅ Получение информации о текущем пользователе
    async getCurrentUser() {
        try {
            const authData = this.getAuthData();
            if (!authData.token) {
                return { success: false, error: 'Не авторизован' };
            }
            
            const response = await fetch(`${this.baseUrl}/user-me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authData.token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения текущего пользователя:', error);
            throw error;
        }
    }

    // ✅ Создание заказа
    async createOrder(orderData) {
        try {
            const response = await fetch(`${this.baseUrl}/create-order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderData)
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка создания заказа:', error);
            throw error;
        }
    }

    // ✅ Создание заказа с баланса
    async createOrderWithBalance(orderData) {
        try {
            const response = await fetch(`${this.baseUrl}/create-order-balance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderData)
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка создания заказа:', error);
            throw error;
        }
    }

    // ✅ Отзывы
    async getReviews() {
        try {
            const response = await fetch(`${this.baseUrl}/reviews`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения отзывов:', error);
            throw error;
        }
    }

    async addReview(reviewData) {
        try {
            const authData = this.getAuthData();
            
            const response = await fetch(`${this.baseUrl}/reviews`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authData.token || ''}`
                },
                body: JSON.stringify(reviewData)
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка добавления отзыва:', error);
            throw error;
        }
    }

    async markReviewHelpful(reviewId, userId) {
        try {
            const response = await fetch(`${this.baseUrl}/reviews/${reviewId}/helpful`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId })
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка отметки отзыва:', error);
            throw error;
        }
    }

    // ✅ Промокоды
    async checkPromocode(code, userId, productId = null) {
        try {
            const response = await fetch(`${this.baseUrl}/promocode-check`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    code,
                    userId,
                    productId
                })
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка проверки промокода:', error);
            throw error;
        }
    }

    async activatePromocode(code, userId) {
        try {
            const response = await fetch(`${this.baseUrl}/promocode-activate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    code,
                    userId
                })
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка активации промокода:', error);
            throw error;
        }
    }

    async getUserPromocodes(userId) {
        try {
            const response = await fetch(`${this.baseUrl}/promocode-user/${userId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения промокодов пользователя:', error);
            throw error;
        }
    }

    // ✅ Discord OAuth
    async discordAuth(code) {
        try {
            const response = await fetch(`${this.baseUrl}/auth-discord`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code })
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка авторизации Discord:', error);
            throw error;
        }
    }

    async sendVerification(userId, code) {
        try {
            const response = await fetch(`${this.baseUrl}/send-verification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId, code })
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка отправки верификации:', error);
            throw error;
        }
    }

    async registerUser(userData) {
        try {
            const response = await fetch(`${this.baseUrl}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            throw error;
        }
    }

    async sendWelcomeMessage(userId) {
        try {
            const response = await fetch(`${this.baseUrl}/welcome-message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId })
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка отправки приветствия:', error);
            throw error;
        }
    }

    // ✅ Выход
    logout() {
        localStorage.removeItem('bhstore_auth');
        localStorage.removeItem('bhstore_orders');
        localStorage.removeItem('bhstore_active_promocodes');
        window.location.href = '/';
    }

    // ✅ Обновление токена
    setAuthToken(token) {
        const authData = this.getAuthData();
        authData.token = token;
        localStorage.setItem('bhstore_auth', JSON.stringify(authData));
        this.authData = authData;
    }

    // ✅ Обновление данных пользователя
    setUserData(userData) {
        const authData = this.getAuthData();
        const updatedData = { ...authData, ...userData };
        localStorage.setItem('bhstore_auth', JSON.stringify(updatedData));
        this.authData = updatedData;
    }
}

// Создаем глобальный экземпляр
const api = new BHStoreAPI();
window.BHStoreAPI = api;

// Для обратной совместимости
window.api = api;