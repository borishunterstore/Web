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

        const userData = JSON.parse(Buffer.from(auth, 'base64').toString());
        
        const isAdmin = userData.username === 'borisonchik_yt' || 
                       userData.username === 'borisonchik' ||
                       userData.id === '992442453833547886';
        
        if (!isAdmin) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ success: false, error: 'Требуются права администратора' })
            };
        }

        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        
        const db = client.db('bhstore');
        const users = db.collection('users');
        
        const allUsers = await users.find({}).toArray();
        
        const formattedUsers = allUsers.map(u => ({
            discordId: u.discordId,
            username: u.username,
            email: u.email || '',
            avatar: u.avatar,
            balance: u.balance || 0,
            badges: u.badges || {},
            orderCount: u.orders?.length || 0,
            registeredAt: u.registeredAt,
            lastOrder: u.orders && u.orders.length > 0 ? u.orders[u.orders.length - 1].date : null
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