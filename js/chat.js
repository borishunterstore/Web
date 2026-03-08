// chat.js - Исправленная версия для пользователей
class ChatSystem {
    constructor() {
        this.api = window.BHStoreAPI || window.api;
        this.userId = null;
        this.messages = [];
        this.pollingInterval = null;
        this.lastChecked = Date.now();
        this.typingTimeout = null;
        this.isTyping = false;
        this.initialized = false;
    }
    
    async init() {
        try {
            if (!this.api) {
                console.error('❌ BHStoreAPI не найден');
                return;
            }

            const authData = this.api.getAuthData();
            this.userId = authData?.id;
            
            if (!this.userId) {
                console.warn('⚠️ Чат: Пользователь не авторизован');
                return;
            }

            console.log('📱 Инициализация чата для пользователя:', this.userId);

            this.loadChatUI();
            this.addChatStyles();
            
            await this.loadMessages();
            
            this.setupEventListeners();
            this.startPolling();
            
            this.initialized = true;
            console.log('✅ Chat System успешно инициализирован');
        } catch (error) {
            console.error('❌ Ошибка инициализации чата:', error);
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
                        <span>Поддержка BHStore</span>
                    </div>
                    <div class="header-status">
                        <span class="status-dot"></span> 
                        <span id="supportStatus">Онлайн</span>
                    </div>
                </div>
                
                <div class="chat-messages-area" id="chatMessages">
                    <div class="chat-welcome">
                        <i class="fas fa-shield-alt"></i>
                        <p>Здравствуйте! Чем мы можем вам помочь?</p>
                        <small>Обычно отвечаем в течение 15 минут</small>
                    </div>
                </div>
                
                <div class="chat-footer">
                    <div id="adminTypingIndicator" class="typing-indicator" style="display: none;">
                        <div class="dot"></div>
                        <div class="dot"></div>
                        <div class="dot"></div>
                        <span>Поддержка печатает...</span>
                    </div>
                    
                    <div class="input-row">
                        <textarea 
                            id="messageInput" 
                            placeholder="Напишите ваш вопрос..." 
                            rows="1"
                        ></textarea>
                        <button id="sendMessage" title="Отправить (Ctrl+Enter)">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                    <div class="input-hint">
                        <i class="fas fa-keyboard"></i>
                        Ctrl+Enter для отправки
                    </div>
                </div>
            </div>
        `;
    }

    addChatStyles() {
        if (document.getElementById('chat-core-styles')) return;
        
        const styles = `
            <style id="chat-core-styles">
                .chat-main-wrapper {
                    background: #2f3136;
                    border-radius: 12px;
                    height: 500px;
                    display: flex;
                    flex-direction: column;
                    border: 1px solid rgba(255,255,255,0.1);
                    overflow: hidden;
                }
                
                .chat-header {
                    padding: 15px 20px;
                    background: #202225;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid rgba(0,0,0,0.2);
                }
                
                .header-info {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    color: white;
                    font-weight: 600;
                }
                
                .header-info i {
                    color: #5865F2;
                    font-size: 1.2rem;
                }
                
                .header-status {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    color: #b9bbbe;
                    font-size: 0.9rem;
                }
                
                .status-dot {
                    width: 8px;
                    height: 8px;
                    background: #43b581;
                    border-radius: 50%;
                    display: inline-block;
                    animation: pulse 2s infinite;
                }
                
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }
                
                .chat-messages-area {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    scroll-behavior: smooth;
                }
                
                .chat-welcome {
                    text-align: center;
                    color: #b9bbbe;
                    padding: 40px 20px;
                }
                
                .chat-welcome i {
                    font-size: 3rem;
                    margin-bottom: 15px;
                    opacity: 0.3;
                    color: #5865F2;
                }
                
                .message-wrapper {
                    display: flex;
                    flex-direction: column;
                    max-width: 80%;
                }
                
                .message-wrapper.user {
                    align-self: flex-end;
                }
                
                .message-wrapper.admin {
                    align-self: flex-start;
                }
                
                .message-sender {
                    font-size: 0.75rem;
                    margin-bottom: 2px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                
                .message-sender.user {
                    color: #5865F2;
                    justify-content: flex-end;
                }
                
                .message-sender.admin {
                    color: #43b581;
                }
                
                .message-bubble {
                    padding: 10px 14px;
                    border-radius: 14px;
                    font-size: 0.95rem;
                    line-height: 1.4;
                    word-wrap: break-word;
                }
                
                .message-bubble.user {
                    background: #5865F2;
                    color: white;
                    border-bottom-right-radius: 4px;
                }
                
                .message-bubble.admin {
                    background: #40444b;
                    color: #dcddde;
                    border-bottom-left-radius: 4px;
                }
                
                .message-time {
                    font-size: 0.7rem;
                    margin-top: 2px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                
                .message-time.user {
                    color: #b9bbbe;
                    justify-content: flex-end;
                }
                
                .message-time.admin {
                    color: #72767d;
                }
                
                .chat-footer {
                    padding: 15px;
                    background: #2f3136;
                    border-top: 1px solid #202225;
                }
                
                .typing-indicator {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    color: #b9bbbe;
                    font-size: 0.8rem;
                    margin-bottom: 8px;
                    padding-left: 5px;
                }
                
                .dot {
                    width: 4px;
                    height: 4px;
                    background: #b9bbbe;
                    border-radius: 50%;
                    animation: bounce 1.4s infinite;
                }
                
                .dot:nth-child(2) { animation-delay: 0.2s; }
                .dot:nth-child(3) { animation-delay: 0.4s; }
                
                @keyframes bounce {
                    0%, 80%, 100% { transform: translateY(0); }
                    40% { transform: translateY(-5px); }
                }
                
                .input-row {
                    display: flex;
                    gap: 10px;
                    align-items: flex-end;
                }
                
                #messageInput {
                    flex: 1;
                    background: #40444b;
                    border: none;
                    border-radius: 8px;
                    color: white;
                    padding: 10px 12px;
                    resize: none;
                    min-height: 40px;
                    max-height: 120px;
                    font-family: inherit;
                    font-size: 0.95rem;
                }
                
                #messageInput:focus {
                    outline: 2px solid #5865F2;
                    background: #484c54;
                }
                
                #sendMessage {
                    background: #5865F2;
                    color: white;
                    border: none;
                    width: 40px;
                    height: 40px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                #sendMessage:hover {
                    background: #4752c4;
                    transform: scale(1.05);
                }
                
                #sendMessage:active {
                    transform: scale(0.95);
                }
                
                .input-hint {
                    font-size: 0.7rem;
                    color: #72767d;
                    margin-top: 5px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                
                .loading-messages {
                    text-align: center;
                    padding: 20px;
                    color: #b9bbbe;
                }
                
                .loading-messages i {
                    font-size: 2rem;
                    margin-bottom: 10px;
                    animation: spin 2s linear infinite;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                .error-message {
                    background: rgba(237, 66, 69, 0.1);
                    border: 1px solid #ED4245;
                    border-radius: 8px;
                    padding: 10px;
                    color: #ED4245;
                    text-align: center;
                    margin: 10px;
                }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', styles);
    }

    async loadMessages() {
        try {
            if (!this.userId) return;
            
            console.log('📥 Загрузка сообщений...');
            
            const messagesContainer = document.getElementById('chatMessages');
            if (messagesContainer) {
                messagesContainer.innerHTML = `
                    <div class="loading-messages">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Загрузка сообщений...</p>
                    </div>
                `;
            }

            const data = await this.api.getChatMessages(this.userId);
            
            if (data.success) {
                this.messages = data.messages || [];
                this.renderMessages();
                this.updateLastChecked();
            } else {
                throw new Error(data.error || 'Ошибка загрузки');
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки сообщений:', error);
            
            const messagesContainer = document.getElementById('chatMessages');
            if (messagesContainer) {
                messagesContainer.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>Не удалось загрузить сообщения</p>
                        <small>Попробуйте обновить страницу</small>
                    </div>
                    <div class="chat-welcome">
                        <i class="fas fa-shield-alt"></i>
                        <p>Напишите нам, если у вас возникли вопросы</p>
                    </div>
                `;
            }
        }
    }

    renderMessages() {
        const container = document.getElementById('chatMessages');
        if (!container) return;

        if (!this.messages || this.messages.length === 0) {
            container.innerHTML = `
                <div class="chat-welcome">
                    <i class="fas fa-shield-alt"></i>
                    <p>Здравствуйте! Чем мы можем вам помочь?</p>
                    <small>Напишите сообщение, и мы ответим в ближайшее время</small>
                </div>
            `;
            return;
        }

        const messagesHTML = this.messages.map(msg => this.createMessageHTML(msg)).join('');
        container.innerHTML = messagesHTML;
        
        this.scrollToBottom();
    }

    createMessageHTML(msg) {
        const isAdmin = msg.from_admin || msg.fromAdmin;
        const time = new Date(msg.timestamp || msg.created_at || Date.now()).toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const content = this.escapeHTML(msg.message || msg.content || '');
        
        return `
            <div class="message-wrapper ${isAdmin ? 'admin' : 'user'}">
                <div class="message-sender ${isAdmin ? 'admin' : 'user'}">
                    <i class="fas fa-${isAdmin ? 'headset' : 'user'}"></i>
                    ${isAdmin ? 'Поддержка' : 'Вы'}
                </div>
                <div class="message-bubble ${isAdmin ? 'admin' : 'user'}">
                    ${content}
                </div>
                <div class="message-time ${isAdmin ? 'admin' : 'user'}">
                    <i class="fas fa-clock"></i>
                    ${time}
                </div>
            </div>
        `;
    }

    async sendMessage() {
        const input = document.getElementById('messageInput');
        if (!input) return;
        
        const text = input.value.trim();
        if (!text) return;

        // Оптимистичное добавление
        const tempMsg = {
            message: text,
            from_admin: false,
            timestamp: new Date().toISOString()
        };
        
        this.messages.push(tempMsg);
        this.appendMessage(tempMsg);
        
        // Очищаем поле
        input.value = '';
        input.style.height = 'auto';

        try {
            console.log('📤 Отправка сообщения...');
            
            // Отправляем через API (сервер сам отправит в Discord)
            await this.api.sendChatMessage(this.userId, text, false);
            
            console.log('✅ Сообщение отправлено');
            
            // Обновляем сообщения через секунду
            setTimeout(() => {
                this.loadMessages();
            }, 1000);
            
        } catch (error) {
            console.error('❌ Ошибка отправки:', error);
            
            // Показываем ошибку
            const container = document.getElementById('chatMessages');
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.innerHTML = `
                <i class="fas fa-exclamation-circle"></i>
                <span>Не удалось отправить сообщение</span>
            `;
            container.appendChild(errorDiv);
            
            setTimeout(() => errorDiv.remove(), 3000);
            
            // Удаляем оптимистичное сообщение
            this.messages = this.messages.filter(m => m !== tempMsg);
            this.renderMessages();
        }
    }

    appendMessage(msg) {
        const container = document.getElementById('chatMessages');
        if (!container) return;
        
        const welcome = container.querySelector('.chat-welcome');
        if (welcome) welcome.remove();
        
        container.insertAdjacentHTML('beforeend', this.createMessageHTML(msg));
        this.scrollToBottom();
    }

    async checkUpdates() {
        try {
            if (!this.userId) return;
            
            const data = await this.api.checkNewMessages(this.userId, this.lastChecked);
            
            if (data && data.hasNew) {
                console.log('📬 Новые сообщения!');
                await this.loadMessages();
            }
            
            const indicator = document.getElementById('adminTypingIndicator');
            if (indicator) {
                indicator.style.display = data?.adminTyping ? 'flex' : 'none';
            }
            
        } catch (error) {
            // Игнорируем ошибки при polling
        }
    }

    setupEventListeners() {
        const input = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendMessage');

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

        sendBtn?.addEventListener('click', (e) => {
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
            await fetch('/api/chat/typing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: this.userId, 
                    isTyping: status, 
                    isAdmin: false 
                })
            });
        } catch (e) {
            // Игнорируем
        }
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
            }, 100);
        }
    }

    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    startPolling() {
        this.stopPolling();
        this.pollingInterval = setInterval(() => this.checkUpdates(), 3000);
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        window.chatSystem = new ChatSystem();
        window.chatSystem.init();
    }, 500);
});

window.addEventListener('beforeunload', () => {
    if (window.chatSystem) {
        window.chatSystem.stopPolling();
    }
});