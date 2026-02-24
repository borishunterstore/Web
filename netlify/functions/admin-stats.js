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

        // Получаем статистику
        const totalUsers = await usersCollection.countDocuments();
        const totalOrders = await ordersCollection.countDocuments();
        
        // Выручка
        const orders = await ordersCollection.find({}).toArray();
        const revenue = orders.reduce((sum, order) => sum + (order.finalPrice || order.amount || 0), 0);
        
        // Новые пользователи за неделю
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const newUsers = await usersCollection.countDocuments({
            registeredAt: { $gte: weekAgo.toISOString() }
        });
        
        const newOrders = await ordersCollection.countDocuments({
            date: { $gte: weekAgo.toISOString() }
        });

        // Последние заказы и пользователи
        const lastOrder = await ordersCollection.findOne({}, { sort: { date: -1 } });
        const lastUser = await usersCollection.findOne({}, { sort: { registeredAt: -1 } });

        await client.close();

        const stats = {
            totalUsers,
            newUsers,
            totalOrders,
            newOrders,
            revenue,
            avgOrderValue: totalOrders > 0 ? Math.round(revenue / totalOrders) : 0,
            conversion: totalUsers > 0 ? Math.round((totalOrders / totalUsers) * 100) : 0,
            lastOrderDate: lastOrder?.date,
            lastUserDate: lastUser?.registeredAt
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                stats
            })
        };
    } catch (error) {
        console.error('Stats error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера' })
        };
    }
};