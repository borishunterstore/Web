const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'bhstore';

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // Проверка авторизации
        const authHeader = event.headers.authorization || '';
        const token = authHeader.replace('Bearer ', '');
        
        if (!token) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, error: 'Не авторизован' })
            };
        }

        // Декодируем токен
        let userData;
        try {
            userData = JSON.parse(Buffer.from(token, 'base64').toString());
        } catch (e) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, error: 'Неверный токен' })
            };
        }

        // Проверка прав администратора
        const adminIds = ['992442453833547886', 'borisonchik_yt'];
        const isAdmin = adminIds.includes(userData.id) || adminIds.includes(userData.username);
        
        if (!isAdmin) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ success: false, error: 'Требуются права администратора' })
            };
        }

        // Подключаемся к MongoDB
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        const db = client.db(DB_NAME);
        const usersCollection = db.collection('users');
        const ordersCollection = db.collection('orders');
        const chatCollection = db.collection('chat_messages');

        // Получаем всех пользователей
        const users = await usersCollection.find({}).toArray();
        
        // Форматируем пользователей
        const formattedUsers = await Promise.all(users.map(async (user) => {
            // Получаем количество заказов
            const orderCount = await ordersCollection.countDocuments({ userId: user.discordId });
            
            // Получаем непрочитанные сообщения
            const unreadMessages = await chatCollection.countDocuments({
                userId: user.discordId,
                fromAdmin: false,
                read: false
            });
            
            return {
                discordId: user.discordId,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                balance: user.balance || 0,
                registeredAt: user.registeredAt,
                badges: user.badges || {},
                orderCount,
                unreadMessages
            };
        }));

        await client.close();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                users: formattedUsers,
                total: formattedUsers.length
            })
        };
    } catch (error) {
        console.error('Users error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера' })
        };
    }
};