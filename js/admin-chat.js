// admin-chat.js - Исправлена двойная отправка в Discord
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
            <div class="chat-container" style="display: grid; grid-template-columns: 300px 1fr; gap: 20px; height: 600px;">
                <div class="users-panel" style="background: #1e1f29; border-radius: 10px; overflow: hidden; display: flex; flex-direction: column;">
                    <div class="users-header" style="padding: 20px; background: #2a2b36; border-bottom: 1px solid #40444b;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <h3 style="margin: 0; color: white;"><i class="fas fa-users"></i> Пользователи</h3>
                            <span class="badge" id="unreadCount" style="background: #ED4245; color: white; padding: 4px 8px; border-radius: 12px; font-size: 0.8rem; display: none;">0</span>
                        </div>
                        <div style="margin-top: 15px;">
                            <input type="text" id="searchUsers" placeholder="Поиск пользователей..." style="width: 100%; padding: 10px; background: #202225; border: 1px solid #40444b; border-radius: 8px; color: white;">
                        </div>
                    </div>
                    <div class="users-list" id="usersList" style="flex: 1; overflow-y: auto; padding: 10px;">
                        <div class="loading" style="text-align: center; padding: 40px; color: #b9bbbe;">
                            <i class="fas fa-spinner fa-spin"></i>
                            <p>Загрузка пользователей...</p>
                        </div>
                    </div>
                </div>
                <div class="chat-panel" style="background: #1e1f29; border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; opacity: 0.5;" id="chatPanel">
                    <div class="no-user-selected" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #b9bbbe; padding: 40px;">
                        <i class="fas fa-comments" style="font-size: 4rem; margin-bottom: 20px; color: #40444b;"></i>
                        <h3 style="color: white; margin-bottom: 10px;">Выберите пользователя</h3>
                        <p style="text-align: center;">Для начала общения выберите пользователя из списка слева</p>
                    </div>
                </div>
            </div>
        `;

        this.addAdminChatStyles();
    }

    addAdminChatStyles() {
        const styleId = 'admin-chat-styles';
        if (document.getElementById(styleId)) return;

        const styles = `
            <style id="${styleId}">
                .user-item {
                    padding: 12px 15px;
                    border-radius: 8px;
                    margin-bottom: 8px;
                    cursor: pointer;
                    transition: all 0.3s;
                    background: #2a2b36;
                    border: 1px solid transparent;
                }
                .user-item:hover {
                    background: #363842;
                    transform: translateX(5px);
                }
                .user-item.active {
                    background: #5865F2;
                    border-color: #4752c4;
                }
                .user-item.unread {
                    border-left: 4px solid #ED4245;
                }
                .user-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .user-avatar {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    object-fit: cover;
                }
                .user-details {
                    flex: 1;
                    overflow: hidden;
                }
                .user-name {
                    color: white;
                    font-weight: 600;
                    margin-bottom: 4px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .user-last-message {
                    color: #b9bbbe;
                    font-size: 0.85rem;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .user-meta {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 4px;
                }
                .message-time {
                    color: #72767d;
                    font-size: 0.75rem;
                    white-space: nowrap;
                }
                .unread-badge {
                    background: #ED4245;
                    color: white;
                    font-size: 0.7rem;
                    padding: 2px 6px;
                    border-radius: 10px;
                    min-width: 20px;
                    text-align: center;
                }
                .typing-indicator {
                    color: #5865F2;
                    font-size: 0.8rem;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                .chat-header {
                    padding: 20px;
                    background: #2a2b36;
                    border-bottom: 1px solid #40444b;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    background: #202225;
                }
                .message {
                    margin-bottom: 15px;
                    max-width: 70%;
                    animation: fadeIn 0.3s ease;
                }
                .message.user {
                    margin-right: auto;
                }
                .message.admin {
                    margin-left: auto;
                }
                .message-content {
                    padding: 12px 16px;
                    border-radius: 18px;
                    position: relative;
                    word-wrap: break-word;
                }
                .message.user .message-content {
                    background: #40444b;
                    color: white;
                    border-bottom-left-radius: 4px;
                }
                .message.admin .message-content {
                    background: #5865F2;
                    color: white;
                    border-bottom-right-radius: 4px;
                }
                .chat-input {
                    padding: 20px;
                    background: #2a2b36;
                    border-top: 1px solid #40444b;
                }
                .chat-input textarea {
                    width: 100%;
                    min-height: 80px;
                    background: #202225;
                    border: 1px solid #40444b;
                    border-radius: 8px;
                    padding: 12px;
                    color: white;
                    resize: vertical;
                    margin-bottom: 10px;
                    font-family: inherit;
                    font-size: 14px;
                }
                .chat-input textarea:focus {
                    outline: none;
                    border-color: #5865F2;
                }
                .chat-actions {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .btn-send {
                    background: #5865F2;
                    color: white;
                    border: none;
                    padding: 10px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .btn-send:hover {
                    background: #4752c4;
                }
                .btn-send:disabled {
                    background: #40444b;
                    cursor: not-allowed;
                }
                .admin-typing {
                    color: #b9bbbe;
                    font-size: 0.9rem;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .user-typing {
                    color: #5865F2;
                    font-size: 0.9rem;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .dot-typing {
                    display: flex;
                    gap: 4px;
                }
                .dot-typing span {
                    width: 6px;
                    height: 6px;
                    background: currentColor;
                    border-radius: 50%;
                    animation: typing 1.4s infinite ease-in-out;
                }
                .dot-typing span:nth-child(1) { animation-delay: -0.32s; }
                .dot-typing span:nth-child(2) { animation-delay: -0.16s; }
                @keyframes typing {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    async loadUsers() {
        try {
            const data = await this.api.getChatUsers();
            this.users = data.users || [];
            this.renderUsersList();
            this.updateUnreadCount();
        } catch (error) {
            console.error('❌ Ошибка загрузки пользователей:', error);
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
            
            return `
                <div class="user-item ${isSelected ? 'active' : ''} ${unreadCount > 0 ? 'unread' : ''}" 
                     data-user-id="${user.discordId}"
                     onclick="window.adminChat.selectUser('${user.discordId}')">
                    <div class="user-info">
                        <img src="${user.avatar ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64` : 'https://cdn.discordapp.com/embed/avatars/0.png'}" 
                             class="user-avatar"
                             alt="${user.username}"
                             onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                        <div class="user-details">
                            <div class="user-name">${user.username || 'Без имени'}</div>
                            <div class="user-last-message">
                                ${isTyping ? `
                                    <div class="typing-indicator">
                                        <i class="fas fa-pencil-alt"></i>
                                        Печатает...
                                    </div>
                                ` : 'Нажмите для начала чата'}
                            </div>
                        </div>
                        <div class="user-meta">
                            ${unreadCount > 0 ? `
                                <div class="unread-badge">${unreadCount}</div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    async selectUser(userId) {
        this.selectedUserId = userId;
        this.renderUsersList();
        await this.loadUserChat(userId);
        this.updateChatPanel();
        this.updateUnreadCount();
        await this.markAsRead(userId);
    }

    async loadUserChat(userId) {
        try {
            const data = await this.api.getChatMessages(userId);
            this.messages = data.messages || [];
            this.renderMessages();
        } catch (error) {
            console.error('Ошибка загрузки чата:', error);
            this.messages = [];
        }
    }

    renderMessages() {
        const container = document.getElementById('chatMessages');
        if (!container) return;

        if (!this.messages || this.messages.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #b9bbbe;">
                    <i class="fas fa-comments"></i>
                    <p>Начните общение</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.messages.map(msg => {
            const time = new Date(msg.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            const messageClass = msg.from_admin ? 'admin' : 'user';
            const senderName = msg.from_admin ? 'Вы' : 'Пользователь';
            
            return `
                <div class="message ${messageClass}">
                    <div class="message-content">
                        ${this.escapeHtml(msg.message)}
                    </div>
                    <div class="message-time">
                        ${senderName} • ${time}
                    </div>
                </div>
            `;
        }).join('');
        
        this.scrollToBottom();
    }

    updateChatPanel() {
        const panel = document.getElementById('chatPanel');
        if (!panel) return;

        const user = this.users.find(u => u.discordId === this.selectedUserId);
        if (!user) return;

        panel.style.opacity = '1';
        panel.innerHTML = `
            <div style="display: flex; flex-direction: column; height: 100%;">
                <div class="chat-header">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <img src="${user.avatar ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64` : 'https://cdn.discordapp.com/embed/avatars/0.png'}" 
                             style="width: 40px; height: 40px; border-radius: 50%;"
                             alt="${user.username}"
                             onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                        <div>
                            <div style="color: white; font-weight: 600;">${user.username || 'Без имени'}</div>
                            <div id="userStatus" style="color: #b9bbbe; font-size: 0.9rem;">
                                ${this.typingUsers.has(user.discordId) ? 'Печатает...' : 'Онлайн'}
                            </div>
                        </div>
                    </div>
                    <div>
                        <button class="btn-admin small" onclick="window.adminChat.showUserInfo('${user.discordId}')">
                            <i class="fas fa-info-circle"></i>
                        </button>
                    </div>
                </div>
                
                <div class="chat-messages" id="chatMessages">
                    ${this.renderMessages()}
                </div>
                
                <div class="chat-input">
                    <div id="typingIndicator" class="user-typing" style="display: none; margin-bottom: 10px;">
                        <i class="fas fa-pencil-alt"></i>
                        <span>Пользователь печатает</span>
                        <div class="dot-typing">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                    
                    <textarea id="adminMessageInput" 
                              placeholder="Введите сообщение..."
                              rows="3"></textarea>
                    
                    <div class="chat-actions">
                        <div class="admin-typing">
                            <i class="fas fa-keyboard"></i>
                            <span>Ctrl+Enter для отправки</span>
                        </div>
                        <button id="sendAdminMessage" class="btn-send">
                            <i class="fas fa-paper-plane"></i>
                            Отправить
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.scrollToBottom();
        this.setupMessageInput();
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
            // Отправляем сообщение через API (сервер сам отправит в Discord)
            await this.api.sendChatMessage(this.selectedUserId, message, true);
            
            // Добавляем в UI
            this.addMessageToUI(message, true);
            
            // Очищаем поле
            input.value = '';
            input.focus();
            
        } catch (error) {
            console.error('Ошибка отправки сообщения:', error);
            alert('Не удалось отправить сообщение');
        }
    }

    addMessageToUI(message, fromAdmin) {
        const container = document.getElementById('chatMessages');
        if (!container) return;

        const time = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const messageClass = fromAdmin ? 'admin' : 'user';
        const senderName = fromAdmin ? 'Вы' : 'Пользователь';
        
        const messageHTML = `
            <div class="message ${messageClass}">
                <div class="message-content">
                    ${this.escapeHtml(message)}
                </div>
                <div class="message-time">
                    ${senderName} • ${time}
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', messageHTML);
        this.scrollToBottom();
    }

    scrollToBottom() {
        const container = document.getElementById('chatMessages');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    setupMessageInput() {
        const input = document.getElementById('adminMessageInput');
        const sendBtn = document.getElementById('sendAdminMessage');
        
        if (!input || !sendBtn) return;
        
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
        const badge = document.getElementById('unreadCount');
        
        if (badge) {
            if (totalUnread > 0) {
                badge.textContent = totalUnread;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
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
}

// Инициализация
window.AdminChat = AdminChat;
window.adminChat = new AdminChat();