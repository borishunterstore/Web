// server.js - полная исправленная версия с чатом
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Конфигурация
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/auth/discord/callback';
const BOT_API_URL = 'http://localhost:8080'; // URL Flask сервера бота

console.log('🚀 Запуск BHStore Server...');
console.log('✅ Client ID:', DISCORD_CLIENT_ID);
console.log('✅ Redirect URI:', DISCORD_REDIRECT_URI);
console.log('✅ Bot API URL:', BOT_API_URL);

// Middleware
app.use(cors());
app.use(express.json());

// Хранилище для чата (в памяти)
let chatStore = {};

app.get('/api/chat/admin/users', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({ success: false, error: 'Не авторизован' });
        }

        const token = authHeader.replace('Bearer ', '');
        
        try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
            
            const allUsers = Object.values(users).map(user => ({
                discordId: user.discordId,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                registeredAt: user.registeredAt,
                balance: user.balance,
                orderCount: user.orders ? user.orders.length : 0,
                lastOrder: user.orders && user.orders.length > 0 
                    ? user.orders[user.orders.length - 1].date 
                    : null,
                unreadMessages: chatStore[user.discordId] ? 
                    chatStore[user.discordId].filter(msg => !msg.fromAdmin && !msg.read).length : 0
            }));
            
            res.json({
                success: true,
                users: allUsers,
                total: allUsers.length
            });
            
        } catch (decodeError) {
            return res.status(401).json({ success: false, error: 'Неверный токен' });
        }
        
    } catch (error) {
        console.error('❌ Ошибка получения пользователей чата:', error.message);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.post('/api/chat/admin/mark-read/:userId', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({ success: false, error: 'Не авторизован' });
        }

        const token = authHeader.replace('Bearer ', '');
        
        try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
            
            const userId = req.params.userId;
            
            if (chatStore[userId]) {
                chatStore[userId].forEach(msg => {
                    if (!msg.fromAdmin) {
                        msg.read = true;
                    }
                });
                
                saveChatToFile();
            }
            
            res.json({
                success: true,
                message: 'Сообщения отмечены как прочитанные'
            });
            
        } catch (decodeError) {
            return res.status(401).json({ success: false, error: 'Неверный токен' });
        }
        
    } catch (error) {
        console.error('❌ Ошибка отметки сообщений:', error.message);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.get('/api/chat/admin/check', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({ success: false, error: 'Не авторизован' });
        }

        const token = authHeader.replace('Bearer ', '');
        
        try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
            
            const unreadCounts = {};
            Object.keys(chatStore).forEach(userId => {
                const unread = chatStore[userId].filter(msg => !msg.fromAdmin && !msg.read).length;
                if (unread > 0) {
                    unreadCounts[userId] = unread;
                }
            });
            
            res.json({
                success: true,
                unreadCounts: unreadCounts,
                totalUnread: Object.values(unreadCounts).reduce((sum, count) => sum + count, 0)
            });
            
        } catch (decodeError) {
            return res.status(401).json({ success: false, error: 'Неверный токен' });
        }
        
    } catch (error) {
        console.error('❌ Ошибка проверки сообщений:', error.message);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Callback маршрут ДО статических файлов
app.get('/auth/discord/callback', (req, res) => {
    const { code, state } = req.query;
    
    console.log('🔗 Discord callback получен!');
    console.log('   Code:', code ? '✓ получен' : '✗ отсутствует');
    console.log('   State:', state || 'не указан');
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Авторизация BHStore</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {
                background: linear-gradient(135deg, #1e1f29 0%, #14151a 100%);
                color: white;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                padding: 20px;
            }
            .container {
                text-align: center;
                padding: 40px;
                background: #2a2b36;
                border-radius: 16px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.4);
                max-width: 500px;
                width: 100%;
            }
            .loader {
                border: 5px solid rgba(255,255,255,0.1);
                border-top: 5px solid #5865F2;
                border-radius: 50%;
                width: 60px;
                height: 60px;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            h2 {
                margin-bottom: 10px;
                color: #5865F2;
            }
            p {
                color: #b9bbbe;
                margin-bottom: 20px;
            }
            .success {
                color: #57F287;
                font-weight: bold;
            }
        </style>
        <script>
            window.onload = function() {
                const code = '${code || ''}';
                const state = '${state || ''}';
                
                if (!code) {
                    document.getElementById('status').textContent = 'Ошибка: код не получен';
                    return;
                }
                
                if (window.opener && !window.opener.closed) {
                    try {
                        window.opener.postMessage({
                            type: 'DISCORD_AUTH_CALLBACK',
                            code: code,
                            state: state
                        }, '*');
                        
                        document.getElementById('status').className = 'success';
                        document.getElementById('status').textContent = 'Авторизация успешна!';
                        document.getElementById('message').textContent = 'Закрываю окно...';
                        
                        setTimeout(function() {
                            window.close();
                        }, 1000);
                        
                    } catch (error) {
                        document.getElementById('status').textContent = 'Ошибка отправки данных';
                    }
                } else {
                    document.getElementById('status').textContent = 'Ошибка: окно авторизации закрыто';
                }
            };
        </script>
    </head>
    <body>
        <div class="container">
            <div class="loader"></div>
            <h2 id="status">Обработка авторизации...</h2>
            <p id="message">Пожалуйста, подождите</p>
        </div>
    </body>
    </html>
    `;
    
    res.send(html);
});

// Статические файлы
app.use(express.static(__dirname));

// Создание папок
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Файлы данных
const usersFile = path.join(dataDir, 'users.json');
const productsFile = path.join(dataDir, 'products.json');
const newsFile = path.join(dataDir, 'news.json');
const chatFile = path.join(dataDir, 'chat.json'); // Новый файл для чата

// Инициализация файлов
function initFiles() {
    try {
        if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, '{}');
        if (!fs.existsSync(productsFile)) {
            fs.writeFileSync(productsFile, JSON.stringify([
                {
                    id: 'premium_month',
                    name: 'Премиум на 1 месяц',
                    description: 'Доступ ко всем премиум функциям бота AniMurk на 30 дней',
                    price: 299,
                    category: 'premium',
                    icon: 'fas fa-crown',
                    popular: true
                }
            ], null, 2));
        }
        if (!fs.existsSync(newsFile)) {
            fs.writeFileSync(newsFile, JSON.stringify([
                {
                    id: 1,
                    title: 'Добро пожаловать в BHStore!',
                    content: 'Магазин успешно запущен.',
                    date: new Date().toISOString().split('T')[0],
                    category: 'announcement'
                }
            ], null, 2));
        }
        if (!fs.existsSync(chatFile)) {
            fs.writeFileSync(chatFile, '{}');
        }
        console.log('✅ Файлы данных инициализированы');
    } catch (error) {
        console.error('❌ Ошибка инициализации файлов:', error.message);
    }
}
initFiles();

// Загрузка пользователей
let users = {};
try {
    users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    console.log(`✅ Загружено ${Object.keys(users).length} пользователей`);
} catch {
    users = {};
}

// Загрузка истории чата из файла
try {
    chatStore = JSON.parse(fs.readFileSync(chatFile, 'utf8'));
    console.log(`✅ Загружено ${Object.keys(chatStore).length} чатов`);
} catch {
    chatStore = {};
}

// Функция для сохранения чата в файл
function saveChatToFile() {
    try {
        fs.writeFileSync(chatFile, JSON.stringify(chatStore, null, 2));
    } catch (error) {
        console.error('❌ Ошибка сохранения чата:', error.message);
    }
}

// Функция для отправки вебхуков в Discord
function sendDiscordWebhook(type, data) {
    const webhookUrl = 'https://discord.com/api/webhooks/1459512369960194260/mtTCwjsSXA2_I7H-zmVbsYd5erD3UZCD9fZ2EiZkVg2KLt-IENQutfE4y393vXY5ryzH';
    
    let embed;
    
    if (type === 'user_message') {
        embed = {
            title: '<:5947mailbox:1459506077950283868> Сообщение от ПОЛЬЗОВАТЕЛЯ',
            description: `<:user:1428757055967068222> **Пользователь:** <@${data.userId}>\n<:embed:1426545603940192336> **Сообщение:** ${data.message}`,
            color: 0x5865F2,
            timestamp: new Date().toISOString()
        };
    } else if (type === 'admin_message') {
        embed = {
            title: '<:5947mailbox:1459506077950283868> Сообщение от АДМИНА',
            description: `<:user:1428757055967068222> **Кому:** <@${data.userId}>\n<:embed:1426545603940192336> **Сообщение:** ${data.message}`,
            color: 0x57F287,
            timestamp: new Date().toISOString()
        };
    }
    
    if (embed) {
        axios.post(webhookUrl, {
            embeds: [embed]
        }).catch(console.error);
    }
}

// ============================================
// API маршруты для чата (унифицированные)
// ============================================

// Получение сообщений пользователя
app.get('/api/chat/messages/:userId', (req, res) => {
    try {
        const userId = req.params.userId;
        const messages = chatStore[userId] || [];
        
        res.json({
            success: true,
            messages: messages,
            total: messages.length
        });
    } catch (error) {
        console.error('❌ Ошибка получения сообщений:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка сервера' 
        });
    }
});

// Отправка сообщения
app.post('/api/chat/send', (req, res) => {
    try {
        const { userId, message, fromAdmin = false } = req.body;
        
        if (!userId || !message) {
            return res.status(400).json({ 
                success: false, 
                error: 'Неверные данные' 
            });
        }
        
        if (!chatStore[userId]) {
            chatStore[userId] = [];
        }
        
        const newMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            message: message,
            fromAdmin: fromAdmin,
            sender: fromAdmin ? 'admin' : 'user',
            timestamp: new Date().toISOString(),
            read: !fromAdmin // Сообщения от пользователя сразу считаем прочитанными админом
        };
        
        chatStore[userId].push(newMessage);
        
        // Ограничиваем историю до 100 сообщений
        if (chatStore[userId].length > 100) {
            chatStore[userId] = chatStore[userId].slice(-100);
        }
        
        // Сохраняем в файл
        saveChatToFile();
        
        // Отправляем уведомление через вебхук
        if (fromAdmin) {
            // Админ отправил сообщение пользователю
            sendDiscordWebhook('admin_message', {
                userId: userId,
                message: message
            });
        } else {
            // Пользователь отправил сообщение админу
            sendDiscordWebhook('user_message', {
                userId: userId,
                message: message
            });
        }
        
        res.json({
            success: true,
            messageId: newMessage.id
        });
        
    } catch (error) {
        console.error('❌ Ошибка отправки сообщения:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка отправки' 
        });
    }
});

// Проверка новых сообщений
app.get('/api/chat/check/:userId', (req, res) => {
    try {
        const userId = req.params.userId;
        const lastChecked = req.query.lastChecked || 0;
        
        const messages = chatStore[userId] || [];
        const newMessages = messages.filter(msg => 
            new Date(msg.timestamp).getTime() > parseInt(lastChecked)
        );
        
        // Проверяем онлайн ли администратор (всегда онлайн для демо)
        const supportOnline = true;
        
        res.json({
            success: true,
            hasNewMessages: newMessages.length > 0,
            newCount: newMessages.length,
            supportOnline: supportOnline,
            lastMessageTime: messages.length > 0 ? 
                new Date(messages[messages.length - 1].timestamp).getTime() : 0
        });
        
    } catch (error) {
        console.error('❌ Ошибка проверки сообщений:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка проверки' 
        });
    }
});

// Создание тикета
app.post('/api/chat/create-ticket', (req, res) => {
    try {
        const { userId } = req.body;
        const ticketId = `TICKET-${Date.now().toString().slice(-8)}`;
        
        // Добавляем системное сообщение в чат
        if (!chatStore[userId]) {
            chatStore[userId] = [];
        }
        
        const systemMessage = {
            id: `sys-${Date.now()}`,
            message: `Создан тикет #${ticketId}. Ваш запрос будет рассмотрен в приоритетном порядке.`,
            fromAdmin: false,
            sender: 'system',
            timestamp: new Date().toISOString(),
            read: true
        };
        
        chatStore[userId].push(systemMessage);
        saveChatToFile();
        
        res.json({
            success: true,
            ticketId: ticketId
        });
        
    } catch (error) {
        console.error('❌ Ошибка создания тикета:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка создания тикета' 
        });
    }
});

// Индикатор набора текста
app.post('/api/chat/typing', (req, res) => {
    try {
        const { userId, isTyping } = req.body;
        
        // В реальном приложении здесь можно сохранять статус набора
        // и уведомлять админа через WebSocket или polling
        
        res.json({ 
            success: true,
            message: 'Статус набора получен'
        });
        
    } catch (error) {
        console.error('❌ Ошибка индикатора набора:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка обработки' 
        });
    }
});

// ============================================
// Основные API маршруты
// ============================================

// API авторизации
app.post('/api/auth/discord', async (req, res) => {
    try {
        const { code } = req.body;
        console.log('🔐 Получен запрос авторизации');

        if (!code) {
            return res.status(400).json({ 
                success: false, 
                error: 'Отсутствует код авторизации' 
            });
        }

        // Получение токена от Discord
        const params = new URLSearchParams();
        params.append('client_id', DISCORD_CLIENT_ID);
        params.append('client_secret', DISCORD_CLIENT_SECRET);
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', DISCORD_REDIRECT_URI);
        params.append('scope', 'identify rpc email openid');

        const tokenResponse = await axios.post(
            'https://discord.com/api/oauth2/token',
            params,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                }
            }
        );

        const { access_token, token_type } = tokenResponse.data;

        // Получение информации о пользователе
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: {
                'Authorization': `${token_type} ${access_token}`,
                'Accept': 'application/json'
            }
        });

        const userData = {
            id: userResponse.data.id,
            username: userResponse.data.username,
            avatar: userResponse.data.avatar,
            email: userResponse.data.email,
            global_name: userResponse.data.global_name || userResponse.data.username
        };

        console.log(`✅ Пользователь: ${userData.username}`);

        // Токен для клиента
        const token = Buffer.from(JSON.stringify({
            ...userData,
            exp: Date.now() + 7 * 24 * 60 * 60 * 1000
        })).toString('base64');

        res.json({
            success: true,
            token: token,
            user: userData
        });

    } catch (error) {
        console.error('❌ Ошибка авторизации:', error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка авторизации через Discord',
            details: error.response?.data || error.message
        });
    }
});

// Глобальная переменная для отслеживания последней отправки кода
let lastCodeSendTime = {};

app.post('/api/send-verification', async (req, res) => {
    try {
        const { userId, code } = req.body;
        console.log(`📨 Отправка кода ${code} пользователю ${userId}`);
        
        // ТОЛЬКО через бота в ЛС, без вебхука
        const botResponse = await axios.post(`${BOT_API_URL}/send_verification`, {
            user_id: userId,
            code: code
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        console.log('✅ Код отправлен через бота:', botResponse.data);

        res.json({ 
            success: true,
            message: 'Код отправлен в личные сообщения Discord'
        });

    } catch (error) {
        console.error('❌ Ошибка отправки через бота:', error.message);
        
        // Fallback: если бот не отвечает, отправляем вебхук
        try {
            const webhookUrl = 'https://discord.com/api/webhooks/1459512369960194260/mtTCwjsSXA2_I7H-zmVbsYd5erD3UZCD9fZ2EiZkVg2KLt-IENQutfE4y393vXY5ryzH';
            await axios.post(webhookUrl, {
                embeds: [{
                    title: '🔐 Код верификации (вебхук)',
                    description: `<@${req.body.userId}> ваш код: \`${req.body.code}\``,
                    color: 0x5865F2,
                    timestamp: new Date().toISOString(),
                    footer: { text: 'BHStore | Вебхук (бот недоступен)' }
                }]
            });
            
            console.log('✅ Код отправлен через вебхук (бот недоступен)');
            
            res.json({ 
                success: true,
                message: 'Код отправлен через вебхук (бот недоступен)',
                method: 'webhook'
            });
        } catch (webhookError) {
            console.error('❌ Ошибка отправки через вебхук:', webhookError.message);
            res.status(500).json({ 
                success: false, 
                error: 'Не удалось отправить код',
                details: error.message
            });
        }
    }
});

// Регистрация пользователя
app.post('/api/register', (req, res) => {
    try {
        const { discordId, username, email, avatar } = req.body;
        console.log(`📝 Регистрация: ${username}`);

        if (users[discordId]) {
            return res.json({ 
                success: true,
                message: 'Пользователь уже зарегистрирован'
            });
        }

        users[discordId] = {
            discordId,
            username,
            email,
            avatar,
            registeredAt: new Date().toISOString(),
            balance: 0,
            orders: []
        };

        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

        res.json({ 
            success: true,
            message: 'Пользователь зарегистрирован'
        });

    } catch (error) {
        console.error('❌ Ошибка регистрации:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка регистрации' 
        });
    }
});

// Отправка приветственного сообщения через бота
app.post('/api/welcome-message', async (req, res) => {
    try {
        const { userId } = req.body;
        console.log(`👋 Приветствие для ${userId}`);

        // Отправляем запрос к боту
        await axios.post(`${BOT_API_URL}/welcome_message`, {
            user_id: userId
        });

        res.json({ success: true });

    } catch (error) {
        console.error('❌ Ошибка приветствия:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка отправки' 
        });
    }
});

app.post('/api/create-order', async (req, res) => {
    try {
        const { userId, productName, price, username, originalPrice, finalPrice, promocodes, discount, discountAmount } = req.body;
        console.log(`🛒 Заказ от ${userId}: ${productName}`);
        console.log(`📊 Цены: оригинальная=${originalPrice}, итоговая=${finalPrice}, скидка=${discount}%`);
        console.log(`📊 Промокоды: ${promocodes ? promocodes.join(', ') : 'нет'}`);
        
        const orderId = `ORD-${Date.now()}`;
        
        // Обновляем баланс пользователя
        if (users[userId]) {
            // Проверяем баланс
            const currentBalance = users[userId].balance || 0;
            console.log(`💰 Текущий баланс: ${currentBalance} ₽`);
            
            // Используем finalPrice (цена со скидкой) для списания
            const priceToDeduct = finalPrice || price;
            console.log(`💰 Сумма к списанию: ${priceToDeduct} ₽`);
            
            if (currentBalance < priceToDeduct) {
                console.log(`❌ Недостаточно средств: нужно ${priceToDeduct} ₽, есть ${currentBalance} ₽`);
                return res.status(400).json({ 
                    success: false, 
                    error: 'Недостаточно средств на балансе' 
                });
            }
            
            // Списываем средства
            users[userId].balance = currentBalance - priceToDeduct;
            console.log(`✅ Баланс после списания: ${users[userId].balance} ₽`);
            
            // Добавляем заказ
            users[userId].orders = users[userId].orders || [];
            users[userId].orders.push({
                id: orderId,
                productName: productName,
                originalPrice: originalPrice || price,
                finalPrice: finalPrice || price,
                discount: discount || 0,
                discountAmount: discountAmount || 0,
                promocodes: promocodes || [],
                date: new Date().toISOString(),
                status: 'completed'
            });

            // Добавляем транзакцию
            if (!users[userId].transactions) {
                users[userId].transactions = [];
            }
            
            users[userId].transactions.push({
                id: `TRX-${Date.now()}`,
                amount: -priceToDeduct,
                type: 'withdrawal',
                reason: `Покупка товара: ${productName} (заказ ${orderId}) ${discount ? `со скидкой ${discount}%` : ''}`,
                date: new Date().toISOString()
            });

            // Обновляем бейдж "Покупатель"
            if (!users[userId].badges) users[userId].badges = {};
            users[userId].badges.buyer = true;

            // Сохраняем изменения в файл
            fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
            
            console.log(`✅ Заказ создан: ${orderId}, списано: ${priceToDeduct} ₽`);
        }

        // Отправляем уведомление
        const webhookUrl = 'https://discord.com/api/webhooks/1459512369960194260/mtTCwjsSXA2_I7H-zmVbsYd5erD3UZCD9fZ2EiZkVg2KLt-IENQutfE4y393vXY5ryzH';
        try {
            await axios.post(webhookUrl, {
                embeds: [{
                    title: '💰 Новая покупка!',
                    description: `<@${userId}> купил "${productName}"`,
                    color: 0x57F287,
                    fields: [
                        { name: 'Оригинальная цена', value: `${originalPrice || price} ₽`, inline: true },
                        { name: 'Итоговая цена', value: `${finalPrice || price} ₽`, inline: true },
                        { name: 'Скидка', value: discount ? `${discount}% (-${discountAmount} ₽)` : '0%', inline: true },
                        { name: 'Промокоды', value: promocodes && promocodes.length > 0 ? promocodes.join(', ') : 'нет', inline: true },
                        { name: 'Заказ', value: orderId, inline: true },
                        { name: 'Баланс', value: `${users[userId]?.balance || 0} ₽`, inline: true }
                    ],
                    timestamp: new Date().toISOString()
                }]
            });
        } catch (webhookError) {
            console.error('Ошибка отправки вебхука:', webhookError.message);
        }

        res.json({
            success: true,
            orderId: orderId,
            newBalance: users[userId]?.balance || 0,
            message: discount ? `Заказ оплачен со скидкой ${discount}%` : 'Заказ успешно оплачен'
        });

    } catch (error) {
        console.error('❌ Ошибка заказа:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка создания заказа' 
        });
    }
});

// Получение товаров
app.get('/api/products', (req, res) => {
    try {
        const products = JSON.parse(fs.readFileSync(productsFile, 'utf8'));
        res.json({ success: true, products });
    } catch (error) {
        console.error('❌ Ошибка товаров:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка загрузки товаров' 
        });
    }
});

app.get('/api/news', (req, res) => {
    console.log('📰 Запрос к /api/news получен');
    
    try {
        const newsPath = path.join(__dirname, 'data', 'news.json');
        console.log('📁 Путь к файлу:', newsPath);
        
        if (!fs.existsSync(newsPath)) {
            console.error('❌ Файл не найден');
            return res.status(404).json({ 
                success: false, 
                error: 'Файл новостей не найден' 
            });
        }
        
        // Читаем файл как буфер для обработки BOM
        const buffer = fs.readFileSync(newsPath);
        
        // Удаляем UTF-8 BOM если есть
        let content = buffer.toString('utf8');
        if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
            content = buffer.toString('utf8', 3); // Пропускаем первые 3 байта (BOM)
            console.log('🔧 Обнаружен и удален UTF-8 BOM');
        }
        
        // Удаляем UTF-16 BOM если есть
        if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
            content = buffer.toString('utf16le', 2);
            console.log('🔧 Обнаружен и удален UTF-16 LE BOM');
        } else if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
            content = buffer.toString('utf16be', 2);
            console.log('🔧 Обнаружен и удален UTF-16 BE BOM');
        }
        
        console.log('📄 Длина контента после обработки:', content.length);
        console.log('📄 Первые 100 символов:', content.substring(0, 100));
        
        // Парсим JSON
        const news = JSON.parse(content);
        console.log(`✅ Успешно загружено ${news.length} новостей`);
        
        res.json({ 
            success: true, 
            news: news,
            total: news.length 
        });
        
    } catch (error) {
        console.error('❌ Ошибка загрузки новостей:', error.message);
        
        // Показываем hex дамп начала файла для отладки
        try {
            const buffer = fs.readFileSync(path.join(__dirname, 'data', 'news.json'));
            console.log('🔍 Hex дамп первых 20 байт файла:');
            console.log(buffer.slice(0, 20).toString('hex').match(/.{2}/g).join(' '));
        } catch (e) {}
        
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка загрузки новостей: ' + error.message 
        });
    }
});


// ============================================
// Админ маршруты
// ============================================

function isAdminUser(decodedToken) {
    const adminIds = ['992442453833547886'];
    return adminIds.includes(decodedToken.id);
}

app.get('/api/admin/users', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({ success: false, error: 'Не авторизован' });
        }

        const token = authHeader.replace('Bearer ', '');
        
        try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
            
            if (!isAdminUser(decoded)) {
                return res.status(403).json({ success: false, error: 'Требуются права администратора' });
            }
            
            const allUsers = Object.values(users).map(user => ({
                discordId: user.discordId,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                registeredAt: user.registeredAt,
                balance: user.balance,
                orderCount: user.orders ? user.orders.length : 0,
                lastOrder: user.orders && user.orders.length > 0 
                    ? user.orders[user.orders.length - 1].date 
                    : null,
                unreadMessages: chatStore[user.discordId] ? 
                    chatStore[user.discordId].filter(msg => !msg.fromAdmin && !msg.read).length : 0
            }));
            
            res.json({
                success: true,
                users: allUsers,
                total: allUsers.length
            });
            
        } catch (decodeError) {
            return res.status(401).json({ success: false, error: 'Неверный токен' });
        }
        
    } catch (error) {
        console.error('❌ Ошибка получения пользователей:', error.message);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.get('/api/admin/orders', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({ success: false, error: 'Не авторизован' });
        }
        
        let allOrders = [];
        
        Object.values(users).forEach(user => {
            if (user.orders && user.orders.length > 0) {
                user.orders.forEach(order => {
                    allOrders.push({
                        ...order,
                        userDiscordId: user.discordId,
                        username: user.username
                    });
                });
            }
        });
        
        // Сортируем по дате (новые сначала)
        allOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        res.json({
            success: true,
            orders: allOrders,
            total: allOrders.length,
            totalRevenue: allOrders.reduce((sum, order) => sum + order.amount, 0)
        });
        
    } catch (error) {
        console.error('❌ Ошибка получения заказов:', error.message);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Отправка сообщения пользователю (только для админа) - совместимость со старым API
app.post('/api/admin/send-message', async (req, res) => {
    try {
        const { userId, message } = req.body;
        
        if (!userId || !message) {
            return res.status(400).json({ success: false, error: 'Отсутствуют данные' });
        }
        
        // Используем унифицированный API чата
        if (!chatStore[userId]) {
            chatStore[userId] = [];
        }
        
        const newMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            message: message,
            fromAdmin: true,
            sender: 'admin',
            timestamp: new Date().toISOString(),
            read: false
        };
        
        chatStore[userId].push(newMessage);
        
        // Ограничиваем историю до 100 сообщений
        if (chatStore[userId].length > 100) {
            chatStore[userId] = chatStore[userId].slice(-100);
        }
        
        saveChatToFile();
        
        // Отправляем через вебхук
        const webhookUrl = 'https://discord.com/api/webhooks/1459512369960194260/mtTCwjsSXA2_I7H-zmVbsYd5erD3UZCD9fZ2EiZkVg2KLt-IENQutfE4y393vXY5ryzH';
        await axios.post(webhookUrl, {
            content: `<@${userId}>`,
            embeds: [{
                title: '📨 Сообщение от администратора BHStore',
                description: message,
                color: 0xFEE75C,
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'Администратор магазина'
                }
            }]
        });
        
        res.json({
            success: true,
            message: 'Сообщение отправлено',
            messageId: newMessage.id
        });
        
    } catch (error) {
        console.error('❌ Ошибка отправки сообщения:', error.message);
        res.status(500).json({ success: false, error: 'Ошибка отправки' });
    }
});

// Получение переписки с пользователем (только для админа) - совместимость со старым API
app.get('/api/admin/chat/:userId', (req, res) => {
    try {
        const userId = req.params.userId;
        const messages = chatStore[userId] || [];
        
        const user = users[userId];
        const userInfo = user ? {
            discordId: user.discordId,
            username: user.username,
            avatar: user.avatar,
            registeredAt: user.registeredAt,
            orderCount: user.orders ? user.orders.length : 0,
            totalSpent: user.orders ? user.orders.reduce((sum, order) => sum + order.amount, 0) : 0
        } : null;
        
        res.json({
            success: true,
            chat: messages,
            userInfo: userInfo
        });
        
    } catch (error) {
        console.error('❌ Ошибка получения переписки:', error.message);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// ============================================
// API для промокодов
// ============================================

const promocodesFile = path.join(dataDir, 'promocodes.json');
const promocodeLogsFile = path.join(dataDir, 'promocode_logs.json');

// Инициализация файла промокодов
if (!fs.existsSync(promocodesFile)) {
    const defaultPromocodes = {
        "WELCOME10": {
            "code": "WELCOME10",
            "type": "discount", // discount, balance, gift
            "value": 10, // процент скидки или сумма пополнения
            "active": true,
            "maxUses": 100,
            "usedCount": 0,
            "usedBy": [],
            "minPurchase": 0, // минимальная сумма покупки
            "productId": null, // null для всех товаров или конкретный productId
            "expiresAt": null, // дата истечения
            "createdAt": new Date().toISOString()
        },
        "BALANCE100": {
            "code": "BALANCE100",
            "type": "balance", // пополнение баланса
            "value": 100, // сумма пополнения в рублях
            "active": true,
            "maxUses": 50,
            "usedCount": 0,
            "usedBy": [],
            "expiresAt": null,
            "createdAt": new Date().toISOString()
        },
        "BHS50": {
            "code": "BHS50",
            "type": "discount",
            "value": 50,
            "active": true,
            "maxUses": 50,
            "usedCount": 0,
            "usedBy": [],
            "productId": null, // скидка на все товары
            "expiresAt": null,
            "createdAt": new Date().toISOString()
        },
        "BHS20": {
            "code": "BHS20",
            "type": "balance",
            "value": 100, // при активации дает 100 рублей
            "active": true,
            "maxUses": 100,
            "usedCount": 0,
            "usedBy": [],
            "expiresAt": "2026-12-31T23:59:59.999Z",
            "createdAt": new Date().toISOString()
        }
    };
    fs.writeFileSync(promocodesFile, JSON.stringify(defaultPromocodes, null, 2));
    console.log('✅ Файл промокодов создан');
}

// Инициализация логов промокодов
if (!fs.existsSync(promocodeLogsFile)) {
    fs.writeFileSync(promocodeLogsFile, JSON.stringify([], null, 2));
}

// Загрузка промокодов
let promocodes = {};
try {
    promocodes = JSON.parse(fs.readFileSync(promocodesFile, 'utf8'));
    console.log(`✅ Загружено ${Object.keys(promocodes).length} промокодов`);
} catch {
    promocodes = {};
}

// Загрузка логов промокодов
let promocodeLogs = [];
try {
    promocodeLogs = JSON.parse(fs.readFileSync(promocodeLogsFile, 'utf8'));
} catch {
    promocodeLogs = [];
}

// Проверка и активация промокода
app.post('/api/promocodes/check', (req, res) => {
    try {
        const { userId, code, productId = null } = req.body;
        
        if (!userId || !code) {
            return res.status(400).json({ 
                success: false, 
                error: 'Не указаны userId или code' 
            });
        }
        
        const codeUpper = code.toUpperCase();
        const promocode = promocodes[codeUpper];
        
        if (!promocode) {
            return res.json({ 
                success: false, 
                error: 'Промокод не найден' 
            });
        }
        
        // Проверка активности
        if (!promocode.active) {
            return res.json({ 
                success: false, 
                error: 'Промокод неактивен' 
            });
        }
        
        // Проверка срока действия
        if (promocode.expiresAt && new Date(promocode.expiresAt) < new Date()) {
            return res.json({ 
                success: false, 
                error: 'Промокод истек' 
            });
        }
        
        // Проверка лимита использования
        if (promocode.usedCount >= promocode.maxUses) {
            return res.json({ 
                success: false, 
                error: 'Промокод больше недействителен' 
            });
        }
        
        // Проверка, использовал ли уже пользователь этот промокод
        if (promocode.usedBy && promocode.usedBy.includes(userId)) {
            return res.json({ 
                success: false, 
                error: 'Вы уже использовали этот промокод' 
            });
        }
        
        // Для скидочных промокодов проверяем товар
        if (promocode.type === 'discount' && promocode.productId && productId && promocode.productId !== productId) {
            console.log(`🔍 Проверка товара: промокод для ${promocode.productId}, запрошен для ${productId}`);
            return res.json({ 
                success: false, 
                error: 'Этот промокод не применяется к данному товару' 
            });
        }
        
        // Проверяем минимальную сумму покупки
        if (promocode.minPurchase && promocode.minPurchase > 0) {
            const user = users[userId];
            const lastOrderAmount = user && user.orders && user.orders.length > 0 ? 
                user.orders[user.orders.length - 1].price : 0;
            
            if (lastOrderAmount < promocode.minPurchase) {
                return res.json({ 
                    success: false, 
                    error: `Для этого промокода минимальная сумма покупки ${promocode.minPurchase} ₽` 
                });
            }
        }
        
        // Всё проверки пройдены
        res.json({
            success: true,
            promocode: {
                id: promocode.code, // Используем code как id
                code: promocode.code,
                type: promocode.type,
                value: promocode.value,
                productId: promocode.productId || null,
                minPurchase: promocode.minPurchase || 0,
                expiresAt: promocode.expiresAt
            }
        });
        
    } catch (error) {
        console.error('❌ Ошибка проверки промокода:', error.message);
        console.error('❌ Stack trace:', error.stack);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка проверки промокода: ' + error.message 
        });
    }
});

// Активация промокода (добавляем в историю пользователя)
app.post('/api/promocodes/activate', async (req, res) => {
    try {
        const { userId, code, type = 'discount', productId = null } = req.body;
        
        if (!userId || !code) {
            return res.status(400).json({ 
                success: false, 
                error: 'Не указаны данные' 
            });
        }
        
        const promocode = promocodes[code.toUpperCase()];

        if (!promocode) {
            return res.status(404).json({ 
                success: false, 
                error: 'Промокод не найден' 
            });
        }
        
        // Повторяем проверки
        if (!promocode.active) {
            return res.status(400).json({ 
                success: false, 
                error: 'Промокод неактивен' 
            });
        }
        
        if (promocode.usedCount >= promocode.maxUses) {
            return res.status(400).json({ 
                success: false, 
                error: 'Промокод больше недействителен' 
            });
        }
        
        if (promocode.usedBy.includes(userId)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Вы уже использовали этот промокод' 
            });
        }
        
        // Обновляем данные промокода
        promocode.usedCount += 1;
        promocode.usedBy.push(userId);
        
        // Добавляем запись в логи
        const logEntry = {
            id: `PROMO-${Date.now()}`,
            userId,
            code: promocode.code,
            type: promocode.type,
            value: promocode.value,
            productId,
            date: new Date().toISOString(),
            status: 'activated'
        };
        
        promocodeLogs.push(logEntry);
        
        // Если промокод на пополнение баланса - пополняем баланс
        if (promocode.type === 'balance') {
            const user = users[userId];
            if (user) {
                user.balance = (user.balance || 0) + promocode.value;
                
                // Добавляем транзакцию
                if (!user.transactions) user.transactions = [];
                user.transactions.push({
                    id: `TRX-${Date.now()}`,
                    amount: promocode.value,
                    type: 'deposit',
                    reason: `Пополнение по промокоду ${promocode.code}`,
                    date: new Date().toISOString()
                });
                
                logEntry.status = 'balance_added';
                logEntry.newBalance = user.balance;
            }
        }
        
        // Сохраняем изменения
        fs.writeFileSync(promocodesFile, JSON.stringify(promocodes, null, 2));
        fs.writeFileSync(promocodeLogsFile, JSON.stringify(promocodeLogs, null, 2));
        
        if (users[userId]) {
            fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
        }
        
        console.log(`🎫 Промокод активирован: ${userId} -> ${promocode.code}`);
        
        // Отправляем уведомление в Discord
        const webhookUrl = 'https://discord.com/api/webhooks/1459512369960194260/mtTCwjsSXA2_I7H-zmVbsYd5erD3UZCD9fZ2EiZkVg2KLt-IENQutfE4y393vXY5ryzH';
        try {
            await axios.post(webhookUrl, {
                embeds: [{
                    title: '🎫 Промокод активирован',
                    description: `<@${userId}> активировал промокод \`${promocode.code}\``,
                    color: 0xFEE75C,
                    fields: [
                        { name: 'Пользователь', value: users[userId]?.username || userId, inline: true },
                        { name: 'Промокод', value: promocode.code, inline: true },
                        { name: 'Тип', value: promocode.type === 'discount' ? 'Скидка' : 'Пополнение', inline: true },
                        { name: 'Значение', value: promocode.type === 'discount' ? `${promocode.value}%` : `${promocode.value} ₽`, inline: true },
                        { name: 'Использований', value: `${promocode.usedCount}/${promocode.maxUses}`, inline: true }
                    ],
                    timestamp: new Date().toISOString()
                }]
            });
        } catch (webhookError) {
            console.error('Ошибка отправки вебхука:', webhookError.message);
        }
        
        res.json({
            success: true,
            message: promocode.type === 'balance' ? 
                `Баланс пополнен на ${promocode.value} ₽` :
                `Промокод "${promocode.code}" активирован`,
            promocode: {
                code: promocode.code,
                type: promocode.type,
                value: promocode.value,
                productId: promocode.productId
            },
            newBalance: users[userId]?.balance || 0
        });
        
    } catch (error) {
        console.error('❌ Ошибка активации промокода:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка активации промокода' 
        });
    }
});

// Получение истории промокодов пользователя
app.get('/api/promocodes/user/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const userLogs = promocodeLogs.filter(log => log.userId === userId);
        
        res.json({
            success: true,
            promocodes: userLogs,
            total: userLogs.length
        });
        
    } catch (error) {
        console.error('❌ Ошибка получения истории промокодов:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка сервера' 
        });
    }
});

// Получение всех промокодов (админ)
app.get('/api/admin/promocodes', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({ success: false, error: 'Не авторизован' });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        
        if (!isAdminUser(decoded)) {
            return res.status(403).json({ 
                success: false, 
                error: 'Требуются права администратора' 
            });
        }
        
        const allPromocodes = Object.values(promocodes);
        const stats = {
            total: allPromocodes.length,
            active: allPromocodes.filter(p => p.active).length,
            discount: allPromocodes.filter(p => p.type === 'discount').length,
            balance: allPromocodes.filter(p => p.type === 'balance').length,
            totalUses: allPromocodes.reduce((sum, p) => sum + p.usedCount, 0)
        };
        
        res.json({
            success: true,
            promocodes: allPromocodes,
            stats
        });
        
    } catch (error) {
        console.error('❌ Ошибка получения промокодов:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка сервера' 
        });
    }
});

// Создание промокода (админ)
app.post('/api/admin/promocodes', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({ success: false, error: 'Не авторизован' });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        
        if (!isAdminUser(decoded)) {
            return res.status(403).json({ 
                success: false, 
                error: 'Требуются права администратора' 
            });
        }
        
        const { code, type, value, maxUses, productId, minPurchase, expiresAt } = req.body;
        
        if (!code || !type || value === undefined) {
            return res.status(400).json({ 
                success: false, 
                error: 'Не указаны обязательные поля' 
            });
        }
        
        const codeUpper = code.toUpperCase();
        
        // Проверяем, не существует ли уже такой промокод
        if (promocodes[codeUpper]) {
            return res.status(400).json({ 
                success: false, 
                error: 'Промокод с таким кодом уже существует' 
            });
        }
        
        const newPromocode = {
            code: codeUpper,
            type: type, // discount, balance, gift
            value: parseFloat(value),
            active: true,
            maxUses: parseInt(maxUses) || 100,
            usedCount: 0,
            usedBy: [],
            productId: productId || null,
            minPurchase: minPurchase ? parseFloat(minPurchase) : 0,
            expiresAt: expiresAt || null,
            createdAt: new Date().toISOString(),
            createdBy: decoded.id
        };
        
        promocodes[codeUpper] = newPromocode;
        fs.writeFileSync(promocodesFile, JSON.stringify(promocodes, null, 2));
        
        console.log(`✅ Создан промокод: ${codeUpper} (${type}: ${value})`);
        
        res.json({
            success: true,
            promocode: newPromocode
        });
        
    } catch (error) {
        console.error('❌ Ошибка создания промокода:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка создания промокода' 
        });
    }
});

// Функция для конвертации старого формата badges
function convertBadgesFormat() {
    let updated = false;
    
    Object.keys(users).forEach(userId => {
        const user = users[userId];
        
        if (user.badges) {
            // Если badges - строка
            if (typeof user.badges === 'string') {
                console.log(`🔄 Конвертация badges для пользователя ${user.username}`);
                
                if (user.badges === 'verified') {
                    user.badges = { verified: true };
                    updated = true;
                } else if (user.badges.includes(',')) {
                    // Если несколько badges через запятую
                    const badgesArray = user.badges.split(',').map(b => b.trim());
                    const badgesObj = {};
                    badgesArray.forEach(badge => {
                        badgesObj[badge] = true;
                    });
                    user.badges = badgesObj;
                    updated = true;
                }
            }
            
            // Если badges - массив
            if (Array.isArray(user.badges)) {
                console.log(`🔄 Конвертация badges массива для пользователя ${user.username}`);
                const badgesObj = {};
                user.badges.forEach(badge => {
                    if (typeof badge === 'string') {
                        badgesObj[badge] = true;
                    } else if (typeof badge === 'object') {
                        Object.assign(badgesObj, badge);
                    }
                });
                user.badges = badgesObj;
                updated = true;
            }
        } else {
            // Если badges не существует, создаем пустой объект
            user.badges = {};
        }
    });
    
    if (updated) {
        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
        console.log('✅ Формат badges обновлен для всех пользователей');
    }
}

// Вызовите эту функцию после загрузки пользователей:
users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
console.log(`✅ Загружено ${Object.keys(users).length} пользователей`);
convertBadgesFormat(); // <-- Добавьте эту строку

// Функция для проверки и обновления бейджей пользователя
function updateUserBadges(userId) {
    const user = users[userId];
    if (!user) return {};
    
    // Инициализируем badges как объект
    if (!user.badges || typeof user.badges !== 'object') {
        user.badges = {};
    }
    
    // Бейдж "Покупатель" - если есть хотя бы 1 завершенный заказ
    if (user.orders && user.orders.length > 0) {
        const completedOrders = user.orders.filter(order => 
            order.status === 'completed' || 
            order.status === 'КУПЛЕНО' || 
            order.status === 'paid'
        );
        user.badges.buyer = completedOrders.length >= 1;
    } else {
        user.badges.buyer = false;
    }
    
    // Бейдж "Верифицированный" - если email подтвержден
    if (user.email && (user.isVerified || user.verifiedAt)) {
        user.badges.verified = true;
    } else {
        user.badges.verified = false;
    }
    
    // Бейдж "Партнер" - для определенных пользователей
    const partnerUsers = [
        '992442453833547886', // borisonchik_yt
        // добавьте другие ID партнеров
    ];
    user.badges.partner = partnerUsers.includes(userId);
    
    return user.badges;
}

// Файл для истории пополнений
const balanceHistoryFile = path.join(dataDir, 'balance_history.json');

// Инициализация файла истории пополнений
if (!fs.existsSync(balanceHistoryFile)) {
    fs.writeFileSync(balanceHistoryFile, JSON.stringify([], null, 2));
}

// Загрузка истории пополнений
let balanceHistory = [];
try {
    balanceHistory = JSON.parse(fs.readFileSync(balanceHistoryFile, 'utf8'));
} catch {
    balanceHistory = [];
}

// API для получения баланса пользователя
app.get('/api/user/:id/balance', (req, res) => {
    try {
        const user = users[req.params.id];
        
        if (!user) {
            return res.json({
                success: true,
                balance: 0,
                currency: 'RUB'
            });
        }
        
        res.json({
            success: true,
            balance: user.balance || 0,
            currency: 'RUB'
        });
        
    } catch (error) {
        console.error('❌ Ошибка получения баланса:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка сервера' 
        });
    }
});

// API для пополнения баланса (админ)
app.post('/api/admin/balance/add', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({ success: false, error: 'Не авторизован' });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        
        if (!isAdminUser(decoded)) {
            return res.status(403).json({ 
                success: false, 
                error: 'Требуются права администратора' 
            });
        }
        
        const { userId, amount, reason } = req.body;
        
        if (!userId || !amount || amount <= 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Неверные данные' 
            });
        }
        
        const user = users[userId];
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'Пользователь не найден' 
            });
        }
        
        // Пополняем баланс
        user.balance = (user.balance || 0) + parseInt(amount);
        
        // Добавляем запись в историю
        const historyEntry = {
            id: `TR-${Date.now()}`,
            userId,
            amount: parseInt(amount),
            reason: reason || 'Пополнение администратором',
            adminId: decoded.id,
            adminName: decoded.username,
            date: new Date().toISOString(),
            type: 'deposit',
            status: 'completed'
        };
        
        balanceHistory.push(historyEntry);
        
        // Сохраняем изменения
        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
        fs.writeFileSync(balanceHistoryFile, JSON.stringify(balanceHistory, null, 2));
        
        console.log(`💰 Баланс пополнен: ${userId} +${amount} ₽`);
        
        // Отправляем уведомление пользователю через Discord
        const webhookUrl = 'https://discord.com/api/webhooks/1459512369960194260/mtTCwjsSXA2_I7H-zmVbsYd5erD3UZCD9fZ2EiZkVg2KLt-IENQutfE4y393vXY5ryzH';
        axios.post(webhookUrl, {
            content: `<@${userId}>`,
            embeds: [{
                title: '💰 Баланс пополнен!',
                description: `Ваш баланс пополнен на **${amount} ₽**`,
                color: 0x57F287,
                fields: [
                    { name: 'Сумма', value: `+${amount} ₽`, inline: true },
                    { name: 'Текущий баланс', value: `${user.balance} ₽`, inline: true },
                    { name: 'Причина', value: reason || 'Пополнение администратором', inline: false },
                    { name: 'Дата', value: new Date().toLocaleString('ru-RU'), inline: true }
                ],
                timestamp: new Date().toISOString()
            }]
        }).catch(console.error);
        
        res.json({
            success: true,
            message: 'Баланс успешно пополнен',
            newBalance: user.balance,
            transactionId: historyEntry.id
        });
        
    } catch (error) {
        console.error('❌ Ошибка пополнения баланса:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка сервера' 
        });
    }
});

// API для списания баланса (админ)
app.post('/api/admin/balance/remove', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({ success: false, error: 'Не авторизован' });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        
        if (!isAdminUser(decoded)) {
            return res.status(403).json({ 
                success: false, 
                error: 'Требуются права администратора' 
            });
        }
        
        const { userId, amount, reason } = req.body;
        
        if (!userId || !amount || amount <= 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Неверные данные' 
            });
        }
        
        const user = users[userId];
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'Пользователь не найден' 
            });
        }
        
        // Проверяем, достаточно ли средств
        if (user.balance < amount) {
            return res.status(400).json({ 
                success: false, 
                error: 'Недостаточно средств на балансе' 
            });
        }
        
        // Списание баланса
        user.balance -= parseInt(amount);
        
        // Добавляем запись в историю
        const historyEntry = {
            id: `TR-${Date.now()}`,
            userId,
            amount: -parseInt(amount),
            reason: reason || 'Списание администратором',
            adminId: decoded.id,
            adminName: decoded.username,
            date: new Date().toISOString(),
            type: 'withdrawal',
            status: 'completed'
        };
        
        balanceHistory.push(historyEntry);
        
        // Сохраняем изменения
        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
        fs.writeFileSync(balanceHistoryFile, JSON.stringify(balanceHistory, null, 2));
        
        console.log(`💰 Баланс списан: ${userId} -${amount} ₽`);
        
        res.json({
            success: true,
            message: 'Баланс успешно списан',
            newBalance: user.balance,
            transactionId: historyEntry.id
        });
        
    } catch (error) {
        console.error('❌ Ошибка списания баланса:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка сервера' 
        });
    }
});

// API для получения истории транзакций пользователя (админ)
app.get('/api/admin/balance/history/:userId', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({ success: false, error: 'Не авторизован' });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        
        if (!isAdminUser(decoded)) {
            return res.status(403).json({ 
                success: false, 
                error: 'Требуются права администратора' 
            });
        }
        
        const { userId } = req.params;
        const userHistory = balanceHistory.filter(entry => entry.userId === userId);
        
        res.json({
            success: true,
            transactions: userHistory.sort((a, b) => new Date(b.date) - new Date(a.date)),
            total: userHistory.length,
            totalDeposits: userHistory.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
            totalWithdrawals: userHistory.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0)
        });
        
    } catch (error) {
        console.error('❌ Ошибка получения истории:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка сервера' 
        });
    }
});

// API для установки баланса (админ)
app.post('/api/admin/balance/set', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({ success: false, error: 'Не авторизован' });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        
        if (!isAdminUser(decoded)) {
            return res.status(403).json({ 
                success: false, 
                error: 'Требуются права администратора' 
            });
        }
        
        const { userId, newBalance, reason } = req.body;
        
        if (!userId || newBalance === undefined || newBalance < 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Неверные данные' 
            });
        }
        
        const user = users[userId];
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'Пользователь не найден' 
            });
        }
        
        const oldBalance = user.balance || 0;
        user.balance = parseInt(newBalance);
        
        // Добавляем запись в историю
        const historyEntry = {
            id: `TR-${Date.now()}`,
            userId,
            oldBalance,
            newBalance: parseInt(newBalance),
            difference: parseInt(newBalance) - oldBalance,
            reason: reason || 'Изменение баланса администратором',
            adminId: decoded.id,
            adminName: decoded.username,
            date: new Date().toISOString(),
            type: 'adjustment',
            status: 'completed'
        };
        
        balanceHistory.push(historyEntry);
        
        // Сохраняем изменения
        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
        fs.writeFileSync(balanceHistoryFile, JSON.stringify(balanceHistory, null, 2));
        
        console.log(`💰 Баланс изменен: ${userId} ${oldBalance} → ${newBalance} ₽`);
        
        res.json({
            success: true,
            message: 'Баланс успешно изменен',
            oldBalance,
            newBalance: user.balance,
            transactionId: historyEntry.id
        });
        
    } catch (error) {
        console.error('❌ Ошибка изменения баланса:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка сервера' 
        });
    }
});

// Маршрут для обновления баланса
app.post('/api/update-balance', (req, res) => {
    try {
        const { userId, amount, reason } = req.body;
        
        if (!userId || !amount) {
            return res.status(400).json({ 
                success: false, 
                error: 'Не указаны userId или amount' 
            });
        }
        
        const user = users[userId];
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'Пользователь не найден' 
            });
        }
        
        // Проверяем, достаточно ли средств для списания
        if (amount < 0 && (user.balance || 0) < Math.abs(amount)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Недостаточно средств на балансе' 
            });
        }
        
        // Обновляем баланс
        user.balance = (user.balance || 0) + parseFloat(amount);
        
        // Добавляем запись в историю транзакций
        if (!user.transactions) {
            user.transactions = [];
        }
        
        user.transactions.push({
            id: `TRX-${Date.now()}`,
            amount: parseFloat(amount),
            type: amount > 0 ? 'deposit' : 'withdrawal',
            reason: reason || 'Обновление баланса',
            date: new Date().toISOString(),
            orderId: req.body.orderId
        });
        
        // Сохраняем изменения
        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
        
        console.log(`💰 Баланс обновлен: ${userId} ${amount > 0 ? '+' : ''}${amount} ₽ = ${user.balance} ₽`);
        
        res.json({
            success: true,
            message: 'Баланс обновлен',
            newBalance: user.balance
        });
        
    } catch (error) {
        console.error('❌ Ошибка обновления баланса:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка обновления баланса' 
        });
    }
});

// Маршрут для обновления бейджей пользователя
app.post('/api/update-user-badges', (req, res) => {
    try {
        const { userId, badges } = req.body;
        
        if (!userId || !badges) {
            return res.status(400).json({ 
                success: false, 
                error: 'Не указаны данные' 
            });
        }
        
        const user = users[userId];
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'Пользователь не найден' 
            });
        }
        
        // Обновляем бейджи
        if (!user.badges) {
            user.badges = {};
        }
        
        Object.assign(user.badges, badges);
        
        // Сохраняем изменения
        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
        
        res.json({
            success: true,
            message: 'Бейджи обновлены',
            badges: user.badges
        });
        
    } catch (error) {
        console.error('❌ Ошибка обновления бейджей:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка обновления бейджей' 
        });
    }
});

// Обновленный API получения пользователя
app.get('/api/user/:id', (req, res) => {
    try {
        const user = users[req.params.id];
        
        if (!user) {
            return res.json({ 
                success: true, 
                user: null 
            });
        }
        
        // Нормализуем бейджи
        let badges = {};
        if (user.badges) {
            if (typeof user.badges === 'string') {
                badges = { verified: user.badges === 'verified' };
            } else if (typeof user.badges === 'object') {
                badges = {
                    verified: !!user.badges.verified,
                    partner: !!user.badges.partner,
                    buyer: !!user.badges.buyer
                };
            }
        }
        
        // Автоматически даем бейдж "Покупатель" если есть заказы
        if (user.orders && user.orders.length > 0) {
            const completedOrders = user.orders.filter(order => 
                order.status === 'completed' || order.status === 'КУПЛЕНО'
            );
            badges.buyer = completedOrders.length >= 1;
        }
        
        res.json({
            success: true,
            user: {
                discordId: user.discordId,
                username: user.username,
                avatar: user.avatar,
                registeredAt: user.registeredAt,
                verifiedAt: user.verifiedAt,
                isVerified: user.isVerified || false,
                balance: user.balance || 0,
                badges: badges,
                orders: user.orders || []
            }
        });

    } catch (error) {
        console.error('❌ Ошибка получения пользователя:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка сервера' 
        });
    }
});

// API для обновления бейджей (админ)
app.post('/api/admin/update-badges', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({ success: false, error: 'Не авторизован' });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        
        if (!isAdminUser(decoded)) {
            return res.status(403).json({ 
                success: false, 
                error: 'Требуются права администратора' 
            });
        }
        
        const { userId, badges } = req.body;
        
        if (!users[userId]) {
            return res.status(404).json({ 
                success: false, 
                error: 'Пользователь не найден' 
            });
        }
        
        // Обновляем бейджи
        users[userId].badges = {
            ...users[userId].badges,
            ...badges
        };
        
        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
        
        res.json({
            success: true,
            message: 'Бейджи обновлены',
            badges: users[userId].badges
        });
        
    } catch (error) {
        console.error('❌ Ошибка обновления бейджей:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка сервера' 
        });
    }
});

// Получение списка промокодов (админ)
app.get('/api/admin/promocodes', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({ success: false, error: 'Не авторизован' });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        
        if (!isAdminUser(decoded)) {
            return res.status(403).json({ 
                success: false, 
                error: 'Требуются права администратора' 
            });
        }
        
        res.json({
            success: true,
            promocodes: promocodes,
            total: promocodes.length,
            stats: {
                active: promocodes.filter(p => new Date(p.validUntil) > new Date() && p.usedCount < p.maxUses).length,
                expired: promocodes.filter(p => new Date(p.validUntil) < new Date()).length,
                used: promocodes.reduce((sum, p) => sum + p.usedCount, 0),
                totalUses: promocodes.reduce((sum, p) => sum + p.maxUses, 0)
            }
        });
        
    } catch (error) {
        console.error('❌ Ошибка получения промокодов:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка сервера' 
        });
    }
});

// Получение статистики (только для админа)
app.get('/api/admin/stats', (req, res) => {
    try {
        const totalUsers = Object.keys(users).length;
        
        // Считаем заказы
        let totalOrders = 0;
        let totalRevenue = 0;
        
        Object.values(users).forEach(user => {
            if (user.orders) {
                totalOrders += user.orders.length;
                totalRevenue += user.orders.reduce((sum, order) => sum + order.amount, 0);
            }
        });
        
        // Новые пользователи за последние 7 дней
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const newUsers = Object.values(users).filter(user => 
            new Date(user.registeredAt) > weekAgo
        ).length;
        
        // Новые заказы за последние 7 дней
        let newOrders = 0;
        Object.values(users).forEach(user => {
            if (user.orders) {
                newOrders += user.orders.filter(order => 
                    new Date(order.date) > weekAgo
                ).length;
            }
        });
        
        // Конверсия
        const conversion = totalUsers > 0 ? Math.round((totalOrders / totalUsers) * 100) : 0;
        
        res.json({
            success: true,
            stats: {
                totalUsers,
                newUsers,
                totalOrders,
                newOrders,
                revenue: totalRevenue,
                conversion,
                avgOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0
            },
            chartData: {
                labels: ['Пользователи', 'Заказы', 'Выручка'],
                values: [totalUsers, totalOrders, totalRevenue]
            }
        });
        
    } catch (error) {
        console.error('❌ Ошибка получения статистики:', error.message);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// ============================================
// HTML маршруты
// ============================================

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/auth.html', (req, res) => res.sendFile(path.join(__dirname, 'auth.html')));
app.get('/verify.html', (req, res) => res.sendFile(path.join(__dirname, 'verify.html')));
app.get('/shop.html', (req, res) => res.sendFile(path.join(__dirname, 'shop.html')));
app.get('/news.html', (req, res) => res.sendFile(path.join(__dirname, 'news.html')));
app.get('/profile.html', (req, res) => res.sendFile(path.join(__dirname, 'profile.html')));
app.get('/legal.html', (req, res) => res.sendFile(path.join(__dirname, 'legal.html')));
app.get('/faq.html', (req, res) => res.sendFile(path.join(__dirname, 'faq.html')));
app.get('/success.html', (req, res) => res.sendFile(path.join(__dirname, 'success.html')));
app.get('/chat.html', (req, res) => res.sendFile(path.join(__dirname, 'chat.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// Тестовый маршрут
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'Сервер работает',
        config: {
            clientId: DISCORD_CLIENT_ID,
            redirectUri: DISCORD_REDIRECT_URI,
            botApiUrl: BOT_API_URL
        },
        stats: {
            users: Object.keys(users).length,
            chatSessions: Object.keys(chatStore).length,
            totalMessages: Object.values(chatStore).reduce((sum, msgs) => sum + msgs.length, 0)
        }
    });
});

// ============================================
// Запуск сервера
// ============================================

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║                           🚀 BHStore Server                          ║
╠══════════════════════════════════════════════════════════════════════╣
║  ✅ Сервер запущен на порту ${PORT}                                  ║
║  ✅ Discord OAuth2 настроен                                         ║
║  ✅ Bot API: ${BOT_API_URL}                                        ║
║  ✅ Пользователей: ${Object.keys(users).length}                      ║
║  ✅ Чатов: ${Object.keys(chatStore).length}                          ║
╚══════════════════════════════════════════════════════════════════════╝
    `);
    console.log('\n📡 Доступные API маршруты:');
    
    
    console.log('  POST /api/admin/balance/add        - Отправка сообщения');
    console.log('  POST /api/admin/balance/remove        - Отправка сообщения');
    console.log('  POST /api/admin/balance/set        - Отправка сообщения');
    console.log('  POST /api/create-order-balance        - Отправка сообщения');
    console.log('  POST /api/admin/update-balance        - Отправка сообщения');
    console.log('  POST /api/admin/send-message        - Отправка сообщения');
    console.log('  POST /api/admin/products        - Отправка сообщения');
    console.log('  POST /api/create-order        - Отправка сообщения');
    console.log('  POST /api/chat/send        - Отправка сообщения');
    console.log('  POST /api/chat/create-ticket        - Отправка сообщения');
    console.log('  POST /api/chat/typing        - Отправка сообщения');
    console.log('  POST /api/admin/users        - Отправка сообщения');
    console.log('  POST /api/user/${userId}/balance        - Отправка сообщения');
    console.log('  POST /api/admin/balance/history/${userId}        - Отправка сообщения');
    console.log('  POST /api/admin/orders        - Отправка сообщения');
    console.log('  POST /api/chat/send        - Отправка сообщения');
    console.log('  POST /api/chat/send        - Отправка сообщения');
});