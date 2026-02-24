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
        const auth = JSON.parse(Buffer.from(event.headers.authorization?.replace('Bearer ', '') || '', 'base64').toString());
        
        // Проверка админа
        if (!auth || (auth.username !== 'borisonchik_yt' && auth.id !== '992442453833547886')) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ success: false, error: 'Требуются права администратора' })
            };
        }

        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        
        const db = client.db('bhstore');
        const users = await db.collection('users').find().toArray();
        
        // Получаем непрочитанные сообщения
        const chatCollection = db.collection('chat_messages');
        const unreadCounts = {};
        
        for (const user of users) {
            const unread = await chatCollection.countDocuments({
                userId: user.discordId,
                fromAdmin: false,
                read: false
            });
            unreadCounts[user.discordId] = unread;
        }
        
        const formattedUsers = users.map(u => ({
            discordId: u.discordId,
            username: u.username,
            avatar: u.avatar,
            email: u.email,
            balance: u.balance || 0,
            registeredAt: u.registeredAt,
            orderCount: u.orders?.length || 0,
            unreadMessages: unreadCounts[u.discordId] || 0
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
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Ошибка сервера' })
        };
    }
};