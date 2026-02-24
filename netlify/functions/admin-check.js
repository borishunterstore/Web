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
        // Получаем токен из заголовка
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

        // Подключаемся к MongoDB
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        const db = client.db(DB_NAME);
        const users = db.collection('users');

        // Ищем пользователя в базе
        const user = await users.findOne({ discordId: userData.id });

        // Проверяем, является ли пользователь админом
        const adminIds = ['992442453833547886', 'borisonchik_yt'];
        const isAdmin = adminIds.includes(userData.id) || 
                       adminIds.includes(userData.username) ||
                       (user && (user.badges?.admin === true || user.badges?.partner === true));

        await client.close();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                isAdmin,
                user: userData
            })
        };
    } catch (error) {
        console.error('Admin check error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера' })
        };
    }
};