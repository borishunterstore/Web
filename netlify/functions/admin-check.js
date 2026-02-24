const { MongoClient } = require('mongodb');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const auth = event.headers.authorization?.replace('Bearer ', '');
        
        if (!auth) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, error: 'Не авторизован' })
            };
        }

        // Декодируем токен
        const userData = JSON.parse(Buffer.from(auth, 'base64').toString());
        
        // Подключаемся к MongoDB
        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        
        const db = client.db('bhstore');
        const users = db.collection('users');
        
        // Ищем пользователя в базе
        const user = await users.findOne({ discordId: userData.id });
        
        // Проверяем права админа
        const isAdmin = user?.badges?.admin === true || 
                       userData.username === 'borisonchik_yt' || 
                       userData.username === 'borisonchik' ||
                       userData.id === '992442453833547886';
        
        await client.close();
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                isAdmin,
                user: user ? {
                    id: user.discordId,
                    username: user.username,
                    badges: user.badges
                } : null
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