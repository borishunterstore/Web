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
        const ordersCollection = db.collection('orders');
        const usersCollection = db.collection('users');
        
        const allOrders = await ordersCollection.find({}).sort({ createdAt: -1 }).toArray();
        
        // Обогащаем заказы информацией о пользователях
        const enrichedOrders = [];
        for (const order of allOrders) {
            const user = await usersCollection.findOne({ discordId: order.userId });
            enrichedOrders.push({
                ...order,
                username: user?.username || 'Неизвестно',
                userAvatar: user?.avatar || null
            });
        }
        
        const totalRevenue = enrichedOrders.reduce((sum, order) => sum + (order.finalPrice || order.amount || 0), 0);
        
        await client.close();
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                orders: enrichedOrders,
                total: enrichedOrders.length,
                totalRevenue
            })
        };
        
    } catch (error) {
        console.error('Orders error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера' })
        };
    }
};