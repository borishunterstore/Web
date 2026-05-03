class AdminChat {
    constructor() {
        this.api = window.api;
        this.selectedUserId = null;
        this.users = [];
        this.messages = [];
        this.pollingInterval = null;
        this.lastMessageDate = {};
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        await this.loadChatUI();
        await this.loadUsers();
        this.setupEventListeners();
        this.startPolling();
        this.isInitialized = true;
        console.log('✅ Админ-чат инициализирован');
    }

    async loadChatUI() {
        const chatContainer = document.getElementById('chatContent');
        if (!chatContainer) return;

        chatContainer.innerHTML = `
            <div class="chat-container" style="display: flex; gap: 20px; height: 70vh; min-height: 500px;">
                <div class="chat-users" style="width: 320px; background: #2a2b36; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden;">
                    <div class="chat-users-header" style="padding: 20px; border-bottom: 1px solid #40444b;">
                        <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-users"></i> Пользователи
                            <span id="totalUnreadBadge" class="unread-badge" style="display: none;">0</span>
                        </h3>
                        <div class="chat-search" style="margin-top: 12px;">
                            <input type="text" id="searchUsers" placeholder="Поиск пользователей..." 
                                   style="width: 100%; padding: 10px; background: #1e1f29; border: 1px solid #40444b; border-radius: 8px; color: white;">
                        </div>
                    </div>
                    <div class="users-list" id="usersList" style="flex: 1; overflow-y: auto; padding: 10px;"></div>
                </div>
                
                <div class="chat-messages" id="chatPanel" style="flex: 1; background: #2a2b36; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden;">
                    <div id="emptyChatState" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #72767d;">
                        <i class="fas fa-comments" style="font-size: 4rem; margin-bottom: 16px;"></i>
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
            await this.updateUnreadCounts();
        } catch (error) {
            console.error('❌ Ошибка загрузки пользователей:', error);
            const usersList = document.getElementById('usersList');
            if (usersList) {
                usersList.innerHTML = `<div style="text-align: center; padding: 40px; color: #ED4245;">Ошибка загрузки</div>`;
            }
        }
    }

    renderUsersList(filter = '') {
        const container = document.getElementById('usersList');
        if (!container) return;

        let filteredUsers = this.users;
        if (filter) {
            const term = filter.toLowerCase();
            filteredUsers = this.users.filter(u => 
                u.username?.toLowerCase().includes(term) ||
                u.discordId?.toString().includes(term)
            );
        }

        if (filteredUsers.length === 0) {
            container.innerHTML = `<div style="text-align: center; padding: 40px; color: #72767d;"><i class="fas fa-user-slash"></i><p>Пользователи не найдены</p></div>`;
            return;
        }

        container.innerHTML = filteredUsers.map(user => {
            const isSelected = this.selectedUserId === user.discordId;
            const unreadCount = user.unreadMessages || 0;
            const lastMsg = this.lastMessageDate[user.discordId] || '';
            
            return `
                <div class="chat-user ${isSelected ? 'active' : ''}" 
                     data-user-id="${user.discordId}"
                     onclick="window.adminChat.selectUser('${user.discordId}')"
                     style="display: flex; align-items: center; gap: 12px; padding: 12px; margin: 5px 0; border-radius: 12px; cursor: pointer; ${isSelected ? 'background: #5865F2;' : 'background: #1e1f29;'}">
                    <div style="position: relative;">
                        <img src="${user.avatar ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64` : 'https://cdn.discordapp.com/embed/avatars/0.png'}" 
                             style="width: 48px; height: 48px; border-radius: 50%;"
                             onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                        ${unreadCount > 0 ? `<span style="position: absolute; top: -5px; right: -5px; background: #ED4245; color: white; border-radius: 50%; padding: 2px 6px; font-size: 11px;">${unreadCount}</span>` : ''}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; ${isSelected ? 'color: white;' : 'color: #b9bbbe;'}">${user.username || 'Без имени'}</div>
                        <div style="font-size: 12px; color: #72767d;">${user.discordId}</div>
                        ${lastMsg ? `<div style="font-size: 11px; color: #72767d; margin-top: 4px;">${lastMsg}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    async selectUser(userId) {
        this.selectedUserId = userId;
        this.renderUsersList();
        await this.loadUserChat(userId);
        await this.markMessagesAsRead(userId);
        this.scrollToBottom();
    }

    async loadUserChat(userId) {
        try {
            const data = await this.api.getChatMessages(userId);
            this.messages = data.messages || [];
            this.renderChatPanel();
        } catch (error) {
            console.error('❌ Ошибка загрузки чата:', error);
            this.messages = [];
            this.renderChatPanel();
        }
    }

    renderChatPanel() {
        const panel = document.getElementById('chatPanel');
        if (!panel) return;

        const user = this.users.find(u => u.discordId === this.selectedUserId);
        if (!user) return;

        panel.innerHTML = `
            <div class="chat-header" style="padding: 16px 20px; border-bottom: 1px solid #40444b; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <img src="${user.avatar ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64` : 'https://cdn.discordapp.com/embed/avatars/0.png'}" 
                         style="width: 40px; height: 40px; border-radius: 50%;"
                         onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                    <div>
                        <h3 style="margin: 0;">${user.username || 'Без имени'}</h3>
                        <p style="margin: 0; font-size: 12px; color: #72767d;">ID: ${user.discordId}</p>
                    </div>
                </div>
                <button onclick="window.adminChat.showUserInfo('${user.discordId}')" 
                        style="background: #1e1f29; border: none; padding: 8px 12px; border-radius: 8px; color: #b9bbbe; cursor: pointer;">
                    <i class="fas fa-info-circle"></i> Инфо
                </button>
            </div>
            
            <div class="chat-messages-list" id="chatMessagesList" style="flex: 1; overflow-y: auto; padding: 20px;"></div>
            
            <div class="chat-input" style="padding: 16px 20px; border-top: 1px solid #40444b;">
                <div style="display: flex; gap: 12px; align-items: flex-end;">
                    <textarea id="adminMessageInput" 
                              placeholder="Введите сообщение..."
                              rows="1"
                              style="flex: 1; padding: 12px; background: #1e1f29; border: 1px solid #40444b; border-radius: 12px; color: white; resize: none; font-family: inherit;"></textarea>
                    <button id="sendAdminMessage" 
                            style="background: #5865F2; border: none; padding: 12px; border-radius: 12px; color: white; cursor: pointer;">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
                <div style="margin-top: 8px; font-size: 11px; color: #72767d; text-align: right;">
                    <i class="fas fa-keyboard"></i> Ctrl+Enter для отправки
                </div>
            </div>
        `;

        const messagesList = document.getElementById('chatMessagesList');
        if (messagesList) {
            messagesList.innerHTML = this.renderMessages();
        }

        this.setupMessageInput();
    }

    renderMessages() {
        if (!this.messages || this.messages.length === 0) {
            return `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #72767d;">
                    <i class="fas fa-comment-dots" style="font-size: 3rem; margin-bottom: 16px;"></i>
                    <p>Нет сообщений. Напишите что-нибудь!</p>
                </div>
            `;
        }

        let lastDate = null;
        let messagesHtml = '';

        this.messages.forEach(msg => {
            const msgDate = new Date(msg.timestamp).toDateString();
            if (lastDate !== msgDate) {
                messagesHtml += `
                    <div style="text-align: center; margin: 20px 0;">
                        <span style="background: #1e1f29; padding: 4px 12px; border-radius: 20px; font-size: 12px; color: #72767d;">
                            ${new Date(msg.timestamp).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                        </span>
                    </div>
                `;
                lastDate = msgDate;
            }

            const isAdmin = msg.from_admin || msg.fromAdmin;
            const time = new Date(msg.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            
            messagesHtml += `
                <div style="display: flex; justify-content: ${isAdmin ? 'flex-end' : 'flex-start'}; margin-bottom: 12px;">
                    <div style="max-width: 70%;">
                        <div style="background: ${isAdmin ? '#5865F2' : '#1e1f29'}; padding: 10px 16px; border-radius: ${isAdmin ? '20px 20px 4px 20px' : '20px 20px 20px 4px'};">
                            <div style="color: white; word-wrap: break-word;">${this.escapeHtml(msg.message)}</div>
                        </div>
                        <div style="font-size: 10px; color: #72767d; margin-top: 4px; ${isAdmin ? 'text-align: right;' : 'text-align: left;'}">
                            ${time} ${isAdmin ? '<i class="fas fa-check-double"></i>' : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        return messagesHtml;
    }

    async sendAdminMessage() {
        const input = document.getElementById('adminMessageInput');
        if (!input || !this.selectedUserId) return;
        
        const message = input.value.trim();
        if (!message) return;
    
        try {
            const result = await this.api.sendChatMessage(this.selectedUserId, message, true);
            
            this.messages.push({
                message: message,
                from_admin: true,
                timestamp: new Date().toISOString()
            });
            
            const messagesList = document.getElementById('chatMessagesList');
            if (messagesList) {
                messagesList.innerHTML = this.renderMessages();
            }
            
            input.value = '';
            input.style.height = 'auto';
            this.scrollToBottom();
            
            this.lastMessageDate[this.selectedUserId] = new Date().toLocaleTimeString();
            
        } catch (error) {
            console.error('❌ Ошибка отправки сообщения:', error);
            this.showNotification('Не удалось отправить сообщение', 'error');
        }
    }

    async markMessagesAsRead(userId) {
        try {
            await this.api.markMessagesAsRead(userId);
            const user = this.users.find(u => u.discordId === userId);
            if (user) {
                user.unreadMessages = 0;
                this.renderUsersList();
                await this.updateUnreadCounts();
            }
        } catch (error) {
            console.error('❌ Ошибка отметки прочитанных:', error);
        }
    }

    async checkNewMessages() {
        if (!this.selectedUserId) return;
        
        try {
            const lastCheck = this.lastMessageDate[this.selectedUserId] || Date.now();
            const data = await this.api.checkNewMessages(this.selectedUserId, lastCheck);
            
            if (data.hasNew) {
                await this.loadUserChat(this.selectedUserId);
                this.scrollToBottom();
            }
        } catch (error) {
            // Ошибку не выводим, чтобы не заспамливать консоль
        }
    }

    async updateUnreadCounts() {
        try {
            const data = await this.api.request('/chat/admin/check');
            if (data.success && data.unreadCounts) {
                let totalUnread = 0;
                this.users.forEach(user => {
                    user.unreadMessages = data.unreadCounts[user.discordId] || 0;
                    totalUnread += user.unreadMessages;
                });
                
                const badge = document.getElementById('totalUnreadBadge');
                if (badge) {
                    if (totalUnread > 0) {
                        badge.textContent = totalUnread;
                        badge.style.display = 'inline-block';
                    } else {
                        badge.style.display = 'none';
                    }
                }
                
                this.renderUsersList();
            }
        } catch (error) {
            console.error('Ошибка обновления счетчиков:', error);
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
        input.focus();
    }

    setupEventListeners() {
        const searchInput = document.getElementById('searchUsers');
        if (searchInput) {
            let timeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => this.renderUsersList(e.target.value), 300);
            });
        }
    }

    startPolling() {
        if (this.pollingInterval) clearInterval(this.pollingInterval);
        this.pollingInterval = setInterval(() => {
            this.checkNewMessages();
            this.updateUnreadCounts();
        }, 5000);
    }

    showUserInfo(userId) {
        const user = this.users.find(u => u.discordId === userId);
        if (!user) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; justify-content: center; align-items: center; z-index: 10000;';
        
        modal.innerHTML = `
            <div style="background: #2a2b36; border-radius: 16px; padding: 30px; max-width: 400px; width: 90%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0;"><i class="fas fa-user"></i> Информация</h2>
                    <button onclick="this.closest('.modal').remove()" style="background: none; border: none; color: #b9bbbe; font-size: 1.5rem; cursor: pointer;">×</button>
                </div>
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="${user.avatar ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=128` : 'https://cdn.discordapp.com/embed/avatars/0.png'}" 
                         style="width: 80px; height: 80px; border-radius: 50%;">
                    <h3 style="margin: 10px 0 5px;">${user.username || 'Без имени'}</h3>
                    <code style="color: #5865F2;">${user.discordId}</code>
                </div>
                <div style="background: #1e1f29; border-radius: 12px; padding: 15px;">
                    <p><i class="fas fa-envelope"></i> Email: ${user.email || 'Не указан'}</p>
                    <p><i class="fas fa-coins"></i> Баланс: ${user.balance || 0} ₽</p>
                    <p><i class="fas fa-shopping-cart"></i> Заказов: ${user.orderCount || 0}</p>
                    <p><i class="fas fa-calendar"></i> Регистрация: ${user.registeredAt ? new Date(user.registeredAt).toLocaleDateString() : 'Неизвестно'}</p>
                </div>
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button onclick="window.addBalance('${user.discordId}', '${user.username}'); this.closest('.modal').remove();" class="btn-admin success" style="flex: 1;">Пополнить</button>
                    <button onclick="window.openUserChat('${user.discordId}'); this.closest('.modal').remove();" class="btn-admin" style="flex: 1;">Открыть чат</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;
        notification.style.cssText = `position: fixed; bottom: 20px; right: 20px; background: ${type === 'success' ? '#57F287' : '#ED4245'}; color: white; padding: 12px 20px; border-radius: 8px; z-index: 10001;`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
}

window.AdminChat = AdminChat;
window.adminChat = new AdminChat();