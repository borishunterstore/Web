// admin-chat.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
class AdminChat {
    constructor() {
        this.api = window.api;
        this.selectedUserId = null;
        this.users = [];
        this.messages = [];
        this.pollingInterval = null;
        this.typingUsers = new Set();
        this.baseUrl = 'https://bhstore.netlify.app';
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        
        await this.loadChatUI();
        await this.loadUsers();
        this.setupEventListeners();
        this.startPolling();
        
        this.isInitialized = true;
        console.log('✅ AdminChat инициализирован');
    }

    async loadChatUI() {
        const chatContainer = document.getElementById('chatContent');
        if (!chatContainer) {
            console.error('❌ Контейнер чата не найден');
            return;
        }

        chatContainer.innerHTML = `
            <div class="chat-container">
                <!-- Левая панель с пользователями -->
                <div class="chat-users">
                    <div class="chat-users-header">
                        <h3><i class="fas fa-users"></i> Пользователи</h3>
                        <div class="chat-search">
                            <input type="text" id="searchUsers" placeholder="Поиск пользователей...">
                            <i class="fas fa-search"></i>
                        </div>
                    </div>
                    <div class="users-list" id="usersList">
                        <div class="loading">
                            <i class="fas fa-spinner fa-spin"></i>
                            <p>Загрузка пользователей...</p>
                        </div>
                    </div>
                </div>
                
                <!-- Правая панель с чатом -->
                <div class="chat-messages" id="chatPanel">
                    <div class="chat-empty-state" id="emptyChatState">
                        <i class="fas fa-comments"></i>
                        <h3>Выберите пользователя</h3>
                        <p>Для начала общения выберите пользователя из списка слева</p>
                    </div>
                </div>
            </div>
        `;
    }

    async loadUsers() {
        try {
            const data = await this.api.getChatUsers();
            this.users = data.users || [];
            this.renderUsersList();
            this.updateUnreadCount();
        } catch (error) {
            console.error('❌ Ошибка загрузки пользователей:', error);
            const usersList = document.getElementById('usersList');
            if (usersList) {
                usersList.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #ED4245;">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>Ошибка загрузки пользователей</p>
                    </div>
                `;
            }
        }
    }

    renderUsersList(filter = '') {
        const container = document.getElementById('usersList');
        if (!container) return;

        let filteredUsers = this.users;
        
        if (filter) {
            const searchTerm = filter.toLowerCase();
            filteredUsers = this.users.filter(user =>
                user.username?.toLowerCase().includes(searchTerm) ||
                (user.discordId && user.discordId.toString().includes(searchTerm))
            );
        }

        if (filteredUsers.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #b9bbbe;">
                    <i class="fas fa-user-slash"></i>
                    <p>Пользователи не найдены</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredUsers.map(user => {
            const isSelected = this.selectedUserId === user.discordId;
            const isTyping = this.typingUsers.has(user.discordId);
            const unreadCount = user.unreadMessages || 0;
            const statusClass = user.online ? 'online' : 'offline';
            
            return `
                <div class="chat-user ${isSelected ? 'active' : ''} ${unreadCount > 0 ? 'unread' : ''}" 
                     data-user-id="${user.discordId}"
                     onclick="window.adminChat.selectUser('${user.discordId}')">
                    <div class="chat-user-avatar">
                        <img src="${user.avatar ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64` : 'https://cdn.discordapp.com/embed/avatars/0.png'}" 
                             alt="${user.username}"
                             onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                        <span class="chat-user-online ${statusClass}"></span>
                    </div>
                    <div class="chat-user-info">
                        <div class="chat-user-name">${user.username || 'Без имени'}</div>
                        <div class="chat-user-status">
                            ${isTyping ? '<span style="color: #5865F2;">Печатает...</span>' : 'Нажмите для начала чата'}
                        </div>
                    </div>
                    ${unreadCount > 0 ? `<span class="chat-user-unread">${unreadCount}</span>` : ''}
                </div>
            `;
        }).join('');
    }

    async selectUser(userId) {
        this.selectedUserId = userId;
        this.renderUsersList();
        await this.loadUserChat(userId);
        this.updateUnreadCount();
        await this.markAsRead(userId);
    }

    async loadUserChat(userId) {
        try {
            const data = await this.api.getChatMessages(userId);
            this.messages = data.messages || [];
            this.renderChatPanel();
        } catch (error) {
            console.error('Ошибка загрузки чата:', error);
            this.messages = [];
            this.renderChatPanel();
        }
    }

    renderChatPanel() {
        const panel = document.getElementById('chatPanel');
        const emptyState = document.getElementById('emptyChatState');
        if (!panel) return;

        const user = this.users.find(u => u.discordId === this.selectedUserId);
        if (!user) return;

        // Скрываем empty state
        if (emptyState) emptyState.style.display = 'none';

        panel.innerHTML = `
            <div class="chat-header">
                <div class="chat-header-info">
                    <div class="chat-header-avatar">
                        <img src="${user.avatar ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64` : 'https://cdn.discordapp.com/embed/avatars/0.png'}" 
                             alt="${user.username}"
                             onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                    </div>
                    <div class="chat-header-text">
                        <h3>${user.username || 'Без имени'}</h3>
                        <p id="userStatus">
                            ${this.typingUsers.has(user.discordId) ? 'Печатает...' : 'Онлайн'}
                        </p>
                    </div>
                </div>
                <div class="chat-header-actions">
                    <button onclick="window.adminChat.showUserInfo('${user.discordId}')" title="Информация">
                        <i class="fas fa-info-circle"></i>
                    </button>
                </div>
            </div>
            
            <div class="chat-messages-list" id="chatMessagesList">
                ${this.renderMessages()}
            </div>
            
            <div class="chat-input">
                <div id="typingIndicator" class="typing-indicator" style="display: none;">
                    <span></span><span></span><span></span>
                </div>
                
                <textarea id="adminMessageInput" 
                          placeholder="Введите сообщение..."
                          rows="1"></textarea>
                <button class="chat-send-btn" id="sendAdminMessage">
                    <i class="fas fa-paper-plane"></i>
                </button>
                
                <div class="chat-input-actions">
                    <span class="chat-input-hint">
                        <i class="fas fa-keyboard"></i> Ctrl+Enter
                    </span>
                </div>
            </div>
        `;

        this.setupMessageInput();
        this.scrollToBottom();
    }

    renderMessages() {
        if (!this.messages || this.messages.length === 0) {
            return `
                <div class="chat-empty-state">
                    <i class="fas fa-comments"></i>
                    <p>Напишите первое сообщение</p>
                </div>
            `;
        }

        let lastDate = null;
        let messagesHtml = '';

        this.messages.forEach(msg => {
            const msgDate = new Date(msg.timestamp).toDateString();
            
            // Добавляем разделитель даты если нужно
            if (lastDate !== msgDate) {
                messagesHtml += `
                    <div class="message-date-divider">
                        <span>${new Date(msg.timestamp).toLocaleDateString('ru-RU', { 
                            day: 'numeric', 
                            month: 'long',
                            year: 'numeric'
                        })}</span>
                    </div>
                `;
                lastDate = msgDate;
            }

            const isAdmin = msg.from_admin || msg.fromAdmin;
            const time = new Date(msg.timestamp).toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            messagesHtml += `
                <div class="message-item ${isAdmin ? 'admin' : 'user'}">
                    <div class="message-text">${this.escapeHtml(msg.message)}</div>
                    <div class="message-time">
                        <i class="fas fa-clock"></i>
                        ${time}
                        ${isAdmin ? '<span class="message-status"><i class="fas fa-check-double"></i></span>' : ''}
                    </div>
                </div>
            `;
        });

        return messagesHtml;
    }

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    async sendAdminMessage() {
        const input = document.getElementById('adminMessageInput');
        if (!input || !this.selectedUserId) return;
        
        const message = input.value.trim();
        if (!message) return;
    
        try {
            console.log('📤 Отправка сообщения от админа...');
            
            // Отправляем сообщение с флагом fromAdmin: true
            const result = await this.api.sendChatMessage(this.selectedUserId, message, true);
            
            console.log('✅ Сообщение отправлено:', result);
            
            // Добавляем в список сообщений
            this.messages.push({
                message: message,
                from_admin: true,
                timestamp: new Date().toISOString()
            });
            
            // Обновляем отображение
            const messagesList = document.getElementById('chatMessagesList');
            if (messagesList) {
                messagesList.innerHTML = this.renderMessages();
            }
            
            // Очищаем поле
            input.value = '';
            input.focus();
            
            this.scrollToBottom();
            
        } catch (error) {
            console.error('❌ Ошибка отправки сообщения:', error);
            this.showNotification('Не удалось отправить сообщение', 'error');
        }
    }

    scrollToBottom() {
        const container = document.getElementById('chatMessagesList');
        if (container) {
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
            }, 100);
        }
    }

    setupMessageInput() {
        const input = document.getElementById('adminMessageInput');
        const sendBtn = document.getElementById('sendAdminMessage');
        
        if (!input || !sendBtn) return;
        
        // Авто-высота textarea
        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.sendAdminMessage();
            }
        });
        
        sendBtn.addEventListener('click', () => this.sendAdminMessage());
    }

    async checkNewMessages() {
        if (!this.selectedUserId) return;
        
        try {
            const data = await this.api.checkNewMessages(this.selectedUserId, Date.now());
            
            if (data.hasNew) {
                await this.loadUserChat(this.selectedUserId);
            }
        } catch (error) {
            // Игнорируем ошибки при проверке
        }
    }

    async markAsRead(userId) {
        try {
            await this.api.markMessagesAsRead(userId);
        } catch (error) {
            console.error('Ошибка отметки как прочитано:', error);
        }
    }

    setupEventListeners() {
        const searchInput = document.getElementById('searchUsers');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.renderUsersList(e.target.value);
            });
        }
    }

    startPolling() {
        this.stopPolling();
        this.pollingInterval = setInterval(() => {
            this.checkNewMessages();
        }, 3000);
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    updateUnreadCount() {
        const totalUnread = this.users.reduce((sum, user) => sum + (user.unreadMessages || 0), 0);
        // Можно добавить бейдж в навигацию если нужно
    }

    showUserInfo(userId) {
        const user = this.users.find(u => u.discordId === userId);
        if (!user) return;
        
        const info = `
👤 Информация о пользователе:

🆔 Discord ID: ${user.discordId}
📝 Имя: ${user.username || 'Без имени'}
📧 Email: ${user.email || 'Не указан'}
💰 Баланс: ${user.balance || 0} ₽
📦 Заказов: ${user.orderCount || 0}
💬 Непрочитанных: ${user.unreadMessages || 0}
📅 Регистрация: ${user.registeredAt ? new Date(user.registeredAt).toLocaleDateString('ru-RU') : 'Неизвестно'}
        `;
        
        alert(info);
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Инициализация
window.AdminChat = AdminChat;
window.adminChat = new AdminChat();