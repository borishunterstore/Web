// netlify/functions/server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const serverless = require('serverless-http');
require('dotenv').config();

const app = express();

// Конфигурация
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'https://bhstore.netlify.app/auth/discord/callback';
const BOT_API_URL = process.env.BOT_API_URL || 'http://bhstore.netlify.app';

console.log('🚀 Запуск BHStore Server (Netlify Function)...');
console.log('✅ Client ID:', DISCORD_CLIENT_ID);
console.log('✅ Redirect URI:', DISCORD_REDIRECT_URI);
console.log('✅ Bot API URL:', BOT_API_URL);

// Middleware
app.use(cors());
app.use(express.json());

// Хранилище для чата (в памяти - для Netlify это временно, лучше использовать БД)
let chatStore = {};

// ============================================
// API маршруты для чата
// ============================================

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
                
                // Для Netlify не используем saveChatToFile() с fs
                // Вместо этого нужно использовать внешнюю БД
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

// Callback маршрут
app.get('/auth/discord/callback', (req, res) => {
    const { code, state } = req.query;
    
    console.log('🔗 Discord callback получен!');
    
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

// ВАЖНО: Для Netlify не используем файловую систему для постоянного хранения!
// Вместо этого используем временное хранилище в памяти или внешнюю БД

// Для демонстрации создаем тестовые данные в памяти
let users = {};
let reviewsData = { reviews: [], stats: { totalReviews: 0, averageRating: 0 } };
let promocodes = {};

// Тестовые данные
const initTestData = () => {
    users = {
        "992442453833547886": {
            discordId: "992442453833547886",
            username: "borisonchik_yt",
            email: "test@example.com",
            avatar: null,
            registeredAt: new Date().toISOString(),
            balance: 1000,
            orders: [],
            badges: { verified: true, admin: true }
        }
    };
    
    promocodes = {
        "WELCOME10": {
            code: "WELCOME10",
            type: "discount",
            value: 10,
            active: true,
            maxUses: 100,
            usedCount: 0,
            usedBy: []
        },
        "BALANCE100": {
            code: "BALANCE100",
            type: "balance",
            value: 100,
            active: true,
            maxUses: 50,
            usedCount: 0,
            usedBy: []
        }
    };
    
    reviewsData = {
        reviews: [
            {
                id: "rev_1",
                userId: "992442453833547886",
                name: "borisonchik_yt",
                avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
                rating: 5,
                productId: "premium_month",
                productName: "Премиум на 1 месяц",
                text: "Отличный сервис!",
                images: [],
                verifiedPurchase: true,
                verified: true,
                helpful: 5,
                createdAt: new Date().toISOString()
            }
        ],
        stats: {
            totalReviews: 1,
            averageRating: 5,
            verifiedPurchases: 1,
            totalHelpful: 5
        }
    };
};

initTestData();

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
            read: !fromAdmin
        };
        
        chatStore[userId].push(newMessage);
        
        // Ограничиваем историю до 100 сообщений
        if (chatStore[userId].length > 100) {
            chatStore[userId] = chatStore[userId].slice(-100);
        }
        
        // Отправляем уведомление через вебхук
        const webhookUrl = 'https://discord.com/api/webhooks/1459512369960194260/mtTCwjsSXA2_I7H-zmVbsYd5erD3UZCD9fZ2EiZkVg2KLt-IENQutfE4y393vXY5ryzH';
        
        axios.post(webhookUrl, {
            embeds: [{
                title: fromAdmin ? '📨 Сообщение от админа' : '💬 Сообщение от пользователя',
                description: message,
                color: fromAdmin ? 0x57F287 : 0x5865F2,
                fields: [{ name: 'Пользователь', value: userId, inline: true }],
                timestamp: new Date().toISOString()
            }]
        }).catch(console.error);
        
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
        params.append('scope', 'identify email');

        const tokenResponse = await axios.post(
            'https://discord.com/api/oauth2/token',
            params,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const { access_token, token_type } = tokenResponse.data;

        // Получение информации о пользователе
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: {
                'Authorization': `${token_type} ${access_token}`
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

        // Сохраняем пользователя в памяти
        if (!users[userData.id]) {
            users[userData.id] = {
                discordId: userData.id,
                username: userData.username,
                email: userData.email,
                avatar: userData.avatar,
                registeredAt: new Date().toISOString(),
                balance: 0,
                orders: [],
                badges: {}
            };
        }

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
            error: 'Ошибка авторизации через Discord'
        });
    }
});

// Отправка кода верификации
app.post('/api/send-verification', async (req, res) => {
    try {
        const { userId, code } = req.body;
        console.log(`📨 Отправка кода ${code} пользователю ${userId}`);
        
        // Отправляем через вебхук Discord
        const webhookUrl = 'https://discord.com/api/webhooks/1459512369960194260/mtTCwjsSXA2_I7H-zmVbsYd5erD3UZCD9fZ2EiZkVg2KLt-IENQutfE4y393vXY5ryzH';
        
        await axios.post(webhookUrl, {
            content: `<@${userId}>`,
            embeds: [{
                title: '🔐 Код верификации',
                description: `Ваш код: \`${code}\``,
                color: 0x5865F2,
                timestamp: new Date().toISOString()
            }]
        });
        
        console.log('✅ Код отправлен через вебхук');
        
        res.json({ 
            success: true,
            message: 'Код отправлен в Discord'
        });

    } catch (error) {
        console.error('❌ Ошибка отправки кода:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Не удалось отправить код'
        });
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
            orders: [],
            badges: {}
        };

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

// Создание заказа
app.post('/api/create-order', async (req, res) => {
    try {
        const { userId, productName, price } = req.body;
        console.log(`🛒 Заказ от ${userId}: ${productName}`);
        
        const orderId = `ORD-${Date.now()}`;
        
        // Обновляем баланс пользователя
        if (users[userId]) {
            const currentBalance = users[userId].balance || 0;
            
            if (currentBalance < price) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Недостаточно средств на балансе' 
                });
            }
            
            users[userId].balance = currentBalance - price;
            
            // Добавляем заказ
            users[userId].orders = users[userId].orders || [];
            users[userId].orders.push({
                id: orderId,
                productName: productName,
                price: price,
                date: new Date().toISOString(),
                status: 'completed'
            });

            // Добавляем бейдж покупателя
            users[userId].badges.buyer = true;
        }

        // Отправляем уведомление
        const webhookUrl = 'https://discord.com/api/webhooks/1459512369960194260/mtTCwjsSXA2_I7H-zmVbsYd5erD3UZCD9fZ2EiZkVg2KLt-IENQutfE4y393vXY5ryzH';
        
        await axios.post(webhookUrl, {
            embeds: [{
                title: '💰 Новая покупка!',
                description: `<@${userId}> купил "${productName}"`,
                color: 0x57F287,
                fields: [
                    { name: 'Цена', value: `${price} ₽`, inline: true },
                    { name: 'Заказ', value: orderId, inline: true },
                    { name: 'Баланс после', value: `${users[userId]?.balance || 0} ₽`, inline: true }
                ],
                timestamp: new Date().toISOString()
            }]
        });

        res.json({
            success: true,
            orderId: orderId,
            newBalance: users[userId]?.balance || 0
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
        const products = [
            {
                id: 'premium_month',
                name: 'Премиум на 1 месяц',
                description: 'Доступ ко всем премиум функциям бота на 30 дней',
                price: 299,
                category: 'premium',
                icon: 'fas fa-crown',
                popular: true
            },
            {
                id: 'premium_year',
                name: 'Премиум на 1 год',
                description: 'Доступ ко всем премиум функциям бота на 365 дней',
                price: 2499,
                category: 'premium',
                icon: 'fas fa-crown',
                discount: 30
            }
        ];
        
        res.json({ success: true, products });
    } catch (error) {
        console.error('❌ Ошибка товаров:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка загрузки товаров' 
        });
    }
});

// Получение новостей
app.get('/api/news', (req, res) => {
    try {
        const news = [
            {
                id: 1,
                title: 'Добро пожаловать в BHStore!',
                content: 'Магазин успешно запущен на Netlify.',
                date: new Date().toISOString().split('T')[0],
                category: 'announcement'
            },
            {
                id: 2,
                title: 'Новые товары',
                content: 'Добавлены премиум подписки!',
                date: new Date().toISOString().split('T')[0],
                category: 'update'
            }
        ];
        
        res.json({ 
            success: true, 
            news: news,
            total: news.length 
        });
        
    } catch (error) {
        console.error('❌ Ошибка загрузки новостей:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка загрузки новостей' 
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
                badges: user.badges || {}
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

// ============================================
// API для промокодов
// ============================================

// Проверка и активация промокода
app.post('/api/promocodes/check', (req, res) => {
    try {
        const { userId, code } = req.body;
        
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
        
        if (!promocode.active) {
            return res.json({ 
                success: false, 
                error: 'Промокод неактивен' 
            });
        }
        
        if (promocode.usedCount >= promocode.maxUses) {
            return res.json({ 
                success: false, 
                error: 'Промокод больше недействителен' 
            });
        }
        
        if (promocode.usedBy && promocode.usedBy.includes(userId)) {
            return res.json({ 
                success: false, 
                error: 'Вы уже использовали этот промокод' 
            });
        }
        
        res.json({
            success: true,
            promocode: {
                code: promocode.code,
                type: promocode.type,
                value: promocode.value
            }
        });
        
    } catch (error) {
        console.error('❌ Ошибка проверки промокода:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка проверки промокода' 
        });
    }
});

// Активация промокода
app.post('/api/promocodes/activate', async (req, res) => {
    try {
        const { userId, code } = req.body;
        
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
        
        // Если промокод на пополнение баланса
        if (promocode.type === 'balance') {
            const user = users[userId];
            if (user) {
                user.balance = (user.balance || 0) + promocode.value;
            }
        }
        
        console.log(`🎫 Промокод активирован: ${userId} -> ${promocode.code}`);
        
        // Отправляем уведомление
        const webhookUrl = 'https://discord.com/api/webhooks/1459512369960194260/mtTCwjsSXA2_I7H-zmVbsYd5erD3UZCD9fZ2EiZkVg2KLt-IENQutfE4y393vXY5ryzH';
        
        await axios.post(webhookUrl, {
            embeds: [{
                title: '🎫 Промокод активирован',
                description: `<@${userId}> активировал промокод \`${promocode.code}\``,
                color: 0xFEE75C,
                fields: [
                    { name: 'Пользователь', value: users[userId]?.username || userId, inline: true },
                    { name: 'Промокод', value: promocode.code, inline: true },
                    { name: 'Тип', value: promocode.type === 'discount' ? 'Скидка' : 'Пополнение', inline: true },
                    { name: 'Значение', value: promocode.type === 'discount' ? `${promocode.value}%` : `${promocode.value} ₽`, inline: true }
                ],
                timestamp: new Date().toISOString()
            }]
        });
        
        res.json({
            success: true,
            message: promocode.type === 'balance' ? 
                `Баланс пополнен на ${promocode.value} ₽` :
                `Промокод "${promocode.code}" активирован`,
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

// ============================================
// API для баланса
// ============================================

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
        
        if (amount < 0 && (user.balance || 0) < Math.abs(amount)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Недостаточно средств на балансе' 
            });
        }
        
        user.balance = (user.balance || 0) + parseFloat(amount);
        
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

// ============================================
// API для отзывов
// ============================================

// GET /api/reviews - получение всех отзывов
app.get('/api/reviews', (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        
        let reviews = [...(reviewsData.reviews || [])];
        
        // Сортируем по дате
        reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Пагинация
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedReviews = reviews.slice(startIndex, endIndex);
        
        res.json({
            success: true,
            reviews: paginatedReviews,
            stats: reviewsData.stats,
            pagination: {
                total: reviews.length,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(reviews.length / limit)
            }
        });
        
    } catch (error) {
        console.error('❌ Ошибка получения отзывов:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка загрузки отзывов' 
        });
    }
});

// POST /api/reviews - создание нового отзыва
app.post('/api/reviews', (req, res) => {
    try {
        const { userId, name, productId, productName, rating, text } = req.body;
        
        console.log('📝 Получен запрос на создание отзыва:', { userId, name, productId, productName, rating });
        
        if (!userId || !name || !productId || !productName || !rating || !text) {
            return res.status(400).json({
                success: false,
                error: 'Заполните все обязательные поля'
            });
        }
        
        if (text.length < 10) {
            return res.status(400).json({
                success: false,
                error: 'Отзыв должен содержать минимум 10 символов'
            });
        }
        
        const user = users[userId];
        const avatar = user?.avatar 
            ? `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png`
            : `https://cdn.discordapp.com/embed/avatars/0.png`;
        
        // Проверяем, покупал ли пользователь этот товар
        const hasPurchased = user?.orders?.some(order => 
            order.productName === productName || order.productId === productId
        ) || false;
        
        const newReview = {
            id: `rev_${Date.now()}`,
            userId,
            name,
            avatar,
            rating: parseInt(rating),
            productId,
            productName,
            text,
            images: [],
            verifiedPurchase: hasPurchased,
            verified: user?.badges?.verified || false,
            helpful: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            adminReply: null
        };
        
        if (!reviewsData.reviews) {
            reviewsData.reviews = [];
        }
        reviewsData.reviews.unshift(newReview);
        
        // Обновляем статистику
        const totalReviews = reviewsData.reviews.length;
        const averageRating = Number((reviewsData.reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1));
        const verifiedPurchases = reviewsData.reviews.filter(r => r.verifiedPurchase).length;
        const totalHelpful = reviewsData.reviews.reduce((sum, r) => sum + (r.helpful || 0), 0);
        
        reviewsData.stats = {
            totalReviews,
            averageRating,
            verifiedPurchases,
            totalHelpful,
            lastUpdated: new Date().toISOString()
        };
        
        console.log(`✅ Отзыв создан: ${newReview.id} от ${name}`);
        
        // Отправляем уведомление в Discord
        const webhookUrl = 'https://discord.com/api/webhooks/1459512369960194260/mtTCwjsSXA2_I7H-zmVbsYd5erD3UZCD9fZ2EiZkVg2KLt-IENQutfE4y393vXY5ryzH';
        
        axios.post(webhookUrl, {
            embeds: [{
                title: '⭐ Новый отзыв!',
                description: `**${name}** оставил отзыв на товар **${productName}**`,
                color: 0xFEE75C,
                fields: [
                    { name: 'Оценка', value: '⭐'.repeat(parseInt(rating)), inline: true },
                    { name: 'Текст', value: text.substring(0, 100) + (text.length > 100 ? '...' : ''), inline: false }
                ],
                timestamp: new Date().toISOString()
            }]
        }).catch(console.error);
        
        res.json({
            success: true,
            message: 'Отзыв успешно добавлен',
            review: newReview
        });
        
    } catch (error) {
        console.error('❌ Ошибка создания отзыва:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка при создании отзыва' 
        });
    }
});

// POST /api/reviews/:id/helpful - отметка "полезно"
app.post('/api/reviews/:id/helpful', (req, res) => {
    try {
        const reviewId = req.params.id;
        
        const reviewIndex = (reviewsData.reviews || []).findIndex(r => r.id === reviewId);
        
        if (reviewIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Отзыв не найден'
            });
        }
        
        reviewsData.reviews[reviewIndex].helpful = (reviewsData.reviews[reviewIndex].helpful || 0) + 1;
        
        // Обновляем статистику
        const totalHelpful = reviewsData.reviews.reduce((sum, r) => sum + (r.helpful || 0), 0);
        reviewsData.stats.totalHelpful = totalHelpful;
        
        res.json({
            success: true,
            message: 'Спасибо за оценку!',
            helpful: reviewsData.reviews[reviewIndex].helpful
        });
        
    } catch (error) {
        console.error('❌ Ошибка отметки "полезно":', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка при отметке' 
        });
    }
});

// ============================================
// API для пользователя
// ============================================

app.get('/api/user/:id', (req, res) => {
    try {
        const user = users[req.params.id];
        
        if (!user) {
            return res.json({ 
                success: true, 
                user: null 
            });
        }
        
        res.json({
            success: true,
            user: {
                discordId: user.discordId,
                username: user.username,
                avatar: user.avatar,
                registeredAt: user.registeredAt,
                balance: user.balance || 0,
                badges: user.badges || {},
                orders: (user.orders || []).slice(-10) // Последние 10 заказов
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

// ============================================
// Админ статистика
// ============================================

app.get('/api/admin/stats', (req, res) => {
    try {
        const totalUsers = Object.keys(users).length;
        
        let totalOrders = 0;
        let totalRevenue = 0;
        
        Object.values(users).forEach(user => {
            if (user.orders) {
                totalOrders += user.orders.length;
                totalRevenue += user.orders.reduce((sum, order) => sum + order.price, 0);
            }
        });
        
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const newUsers = Object.values(users).filter(user => 
            new Date(user.registeredAt) > weekAgo
        ).length;
        
        let newOrders = 0;
        Object.values(users).forEach(user => {
            if (user.orders) {
                newOrders += user.orders.filter(order => 
                    new Date(order.date) > weekAgo
                ).length;
            }
        });
        
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

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>BHStore</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1e1f29; color: white; }
                h1 { color: #5865F2; }
                .api-info { background: #2a2b36; padding: 20px; border-radius: 10px; margin-top: 20px; }
            </style>
        </head>
        <body>
            <h1>🚀 BHStore API работает на Netlify Functions</h1>
            <div class="api-info">
                <p>✅ Сервер успешно запущен</p>
                <p>📊 Пользователей: ${Object.keys(users).length}</p>
                <p>⭐ Отзывов: ${reviewsData.reviews?.length || 0}</p>
                <p>🎫 Промокодов: ${Object.keys(promocodes).length}</p>
            </div>
        </body>
        </html>
    `);
});

// Тестовый маршрут
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'Сервер работает на Netlify Functions',
        stats: {
            users: Object.keys(users).length,
            chatSessions: Object.keys(chatStore).length,
            totalMessages: Object.values(chatStore).reduce((sum, msgs) => sum + msgs.length, 0),
            reviews: reviewsData.reviews?.length || 0,
            promocodes: Object.keys(promocodes).length
        }
    });
});

// ВАЖНО: В Netlify НЕ ИСПОЛЬЗУЕМ app.listen()!
// Вместо этого экспортируем handler для serverless

module.exports.handler = serverless(app);