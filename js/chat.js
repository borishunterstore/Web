// js/chat.js - Клиентская часть чата
class ChatSystem {
    constructor() {
        // Используем глобальный API
        this.api = window.BHStoreAPI || window.api;
        if (!this.api) {
            console.error('❌ BHStoreAPI not found');
            this.api = {
                getChatMessages: async (userId) => {
                    const response = await fetch(`/.netlify/functions/server/api/chat/messages/${userId}`);
                    const data = await response.json();
                    return data.messages || [];
                },
                sendChatMessage: async (userId, message, fromAdmin) => {
                    const response = await fetch('/.netlify/functions/server/api/chat/send', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ userId, message, fromAdmin })
                    });
                    return await response.json();
                },
                checkNewMessages: async (userId, lastChecked) => {
                    const response = await fetch(`/.netlify/functions/server/api/chat/check`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ userId, lastChecked })
                    });
                    return await response.json();
                }
            };
        }
        this.userId = null;
        this.messages = [];
        this.pollingInterval = null;
        this.lastChecked = 0;
        this.typingTimeout = null;
        this.isTyping = false;
    }
    
    async init() {
        try {
            const authDataRaw = localStorage.getItem('bhstore_auth');
            const authData = authDataRaw ? JSON.parse(authDataRaw) : null;
            this.userId = authData?.id;
            
            if (!this.userId) {
                console.warn('Чат: Пользователь не авторизован');
                return;
            }

            this.loadChatUI();
            this.addChatStyles();
            await this.loadMessages();
            this.setupEventListeners();
            this.startPolling();
            
            console.log('✅ Chat System Initialized');
        } catch (error) {
            console.error('Ошибка инициализации чата:', error);
        }
    }

    loadChatUI() {
        const container = document.getElementById('supportChat');
        if (!container) return;

        container.innerHTML = `
            <div class="chat-main-wrapper">
                <div class="chat-header">
                    <div class="header-info">
                        <i class="fas fa-headset"></i>
                        <span>Центр поддержки</span>
                    </div>
                    <div class="header-status">
                        <span class="status-dot"></span> Онлайн
                    </div>
                </div>
                
                <div class="chat-messages-area" id="chatMessages">
                    <div class="chat-welcome">
                        <i class="fas fa-shield-alt"></i>
                        <p>Напишите нам, если у вас возникли вопросы. <br>Мы отвечаем в течение 15 минут.</p>
                    </div>
                </div>
                
                <div class="chat-footer">
                    <div id="adminTypingIndicator" class="typing-indicator">
                        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
                        <span>Поддержка печатает...</span>
                    </div>
                    
                    <div class="input-row">
                        <textarea id="messageInput" placeholder="Ваш вопрос..." rows="1"></textarea>
                        <button id="sendMessage" title="Отправить (Ctrl+Enter)">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                    <div class="input-hint">Нажмите Ctrl+Enter для быстрой отправки</div>
                </div>
            </div>
        `;
    }

    addChatStyles() {
        if (document.getElementById('chat-core-styles')) return;
        const styles = `
            <style id="chat-core-styles">
                .chat-main-wrapper { background: #2f3136; border-radius: 12px; height: 500px; display: flex; flex-direction: column; border: 1px solid rgba(255,255,255,0.05); }
                .chat-header { padding: 15px 20px; background: #202225; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0,0,0,0.2); }
                .status-dot { width: 8px; height: 8px; background: #43b581; border-radius: 50%; display: inline-block; margin-right: 5px; }
                
                .chat-messages-area { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; scroll-behavior: smooth; }
                .chat-welcome { text-align: center; color: #b9bbbe; padding: 20px; font-size: 0.9rem; }
                .chat-welcome i { font-size: 2rem; margin-bottom: 10px; opacity: 0.3; }

                .msg-bubble { max-width: 80%; padding: 10px 14px; border-radius: 14px; position: relative; font-size: 0.95rem; line-height: 1.4; }
                .msg-bubble.user { align-self: flex-end; background: #5865f2; color: white; border-bottom-right-radius: 2px; }
                .msg-bubble.admin { align-self: flex-start; background: #40444b; color: #dcddde; border-bottom-left-radius: 2px; }
                .msg-time { font-size: 0.7rem; opacity: 0.6; margin-top: 4px; display: block; text-align: right; }

                .chat-footer { padding: 15px; background: #2f3136; }
                .input-row { display: flex; gap: 10px; align-items: flex-end; }
                #messageInput { flex: 1; background: #40444b; border: none; border-radius: 8px; color: white; padding: 10px; resize: none; min-height: 40px; max-height: 120px; transition: 0.2s; }
                #sendMessage { background: #5865f2; color: white; border: none; width: 40px; height: 40px; border-radius: 8px; cursor: pointer; transition: 0.3s; }
                #sendMessage:hover { background: #4752c4; }
                
                .typing-indicator { display: none; align-items: center; gap: 4px; color: #b9bbbe; font-size: 0.8rem; margin-bottom: 8px; }
                .dot { width: 4px; height: 4px; background: #b9bbbe; border-radius: 50%; animation: bounce 1.4s infinite; }
                .dot:nth-child(2) { animation-delay: 0.2s; }
                .dot:nth-child(3) { animation-delay: 0.4s; }
                @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-5px); } }
                .input-hint { font-size: 0.7rem; color: #72767d; margin-top: 5px; }
            </style>
        `;
        document.head.insertAdjacentHTML('beforeend', styles);
    }

    async loadMessages() {
        try {
            if (!this.userId) return;
            
            console.log('📥 Загрузка сообщений для userId:', this.userId);
            const data = await this.api.getChatMessages(this.userId);
            console.log('📨 Messages loaded:', data);
            
            if (data) {
                this.messages = Array.isArray(data) ? data : (data.messages || []);
                this.renderMessages();
                this.updateLastChecked();
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки сообщений:', error);
        }
    }

    renderMessages() {
        const container = document.getElementById('chatMessages');
        if (!container) return;

        if (this.messages.length === 0) {
            container.innerHTML = `
                <div class="chat-welcome">
                    <i class="fas fa-shield-alt"></i>
                    <p>Напишите нам, если у вас возникли вопросы. <br>Мы отвечаем в течение 15 минут.</p>
                </div>
            `;
            return;
        }

        const html = this.messages.map(msg => this.createMessageHTML(msg)).join('');
        container.innerHTML = html;
        this.scrollToBottom();
    }

    createMessageHTML(msg) {
        const isUser = !msg.from_admin && !msg.fromAdmin;
        const time = new Date(msg.timestamp || msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const content = this.escapeHTML(msg.message || msg.content || '');
        
        return `
            <div class="msg-bubble ${isUser ? 'user' : 'admin'}">
                <div class="msg-text">${content}</div>
                <span class="msg-time">${time}</span>
            </div>
        `;
    }

    async sendMessage() {
        const input = document.getElementById('messageInput');
        if (!input) return;
        
        const text = input.value.trim();
        if (!text) return;

        // Оптимистичное добавление в UI
        const tempMsg = { 
            message: text, 
            from_admin: false, 
            timestamp: new Date().toISOString() 
        };
        this.messages.push(tempMsg);
        this.appendSingleMessage(tempMsg);
        
        input.value = '';
        if (input.style) {
            input.style.height = 'auto';
        }

        try {
            console.log('📤 Отправка сообщения...');
            const result = await this.api.sendChatMessage(this.userId, text, false);
            console.log('✅ Message sent:', result);
        } catch (error) {
            console.error('❌ Ошибка отправки:', error);
        }
    }

    appendSingleMessage(msg) {
        const container = document.getElementById('chatMessages');
        if (!container) return;
        
        // Убираем приветствие если оно есть
        const welcome = container.querySelector('.chat-welcome');
        if (welcome) welcome.remove();
        
        container.insertAdjacentHTML('beforeend', this.createMessageHTML(msg));
        this.scrollToBottom();
    }

    async checkUpdates() {
        try {
            if (!this.userId) return;
            
            // Используем метод API
            const data = await this.api.checkNewMessages(this.userId, this.lastChecked);
    
            if (data && data.hasNew) {
                await this.loadMessages();
            }
            
            // Показываем/скрываем статус "Админ печатает"
            const indicator = document.getElementById('adminTypingIndicator');
            if (indicator) {
                indicator.style.display = data?.adminTyping ? 'flex' : 'none';
            }
        } catch (e) { 
            // Игнорируем ошибки поллинга
        }
    }

    setupEventListeners() {
        const input = document.getElementById('messageInput');
        const btn = document.getElementById('sendMessage');

        if (!input) return;

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                this.sendMessage();
            }
            this.handleTyping();
        });

        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        });

        btn?.addEventListener('click', (e) => {
            e.preventDefault();
            this.sendMessage();
        });
    }

    handleTyping() {
        if (!this.isTyping) {
            this.isTyping = true;
            this.sendTypingStatus(true);
        }
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            this.isTyping = false;
            this.sendTypingStatus(false);
        }, 2000);
    }

    async sendTypingStatus(status) {
        try {
            await fetch('/.netlify/functions/server/api/chat/typing', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ userId: this.userId, isTyping: status, isAdmin: false })
            });
        } catch (e) {}
    }

    updateLastChecked() {
        if (this.messages.length > 0) {
            const lastMsg = this.messages[this.messages.length - 1];
            this.lastChecked = new Date(lastMsg.timestamp || lastMsg.created_at || Date.now()).getTime();
        }
    }

    scrollToBottom() {
        const container = document.getElementById('chatMessages');
        if (container) {
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
            }, 50);
        }
    }

    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    startPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
        this.pollingInterval = setInterval(() => this.checkUpdates(), 3000);
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }
}

// Запуск
document.addEventListener('DOMContentLoaded', () => {
    window.chatSystem = new ChatSystem();
    window.chatSystem.init();
});

window.addEventListener('beforeunload', () => {
    if (window.chatSystem) {
        window.chatSystem.stopPolling();
    }
});