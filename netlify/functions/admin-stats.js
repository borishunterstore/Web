// netlify/functions/admin-stats.js
const { MongoClient } = require('mongodb');

// Строка подключения к MongoDB должна быть в переменных окружения Netlify
const MONGODB_URI = process.env.MONGODB_URI;

// Настройки CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Обработчик функции
exports.handler = async (event) => {
  // Обработка preflight-запроса OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Разрешаем только GET-запросы
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method Not Allowed' }),
    };
  }

  // Проверка авторизации (упрощенная, для примера)
  // В реальном проекте здесь должна быть полноценная проверка JWT токена
  const authHeader = event.headers.authorization;
  if (!authHeader) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ success: false, error: 'Unauthorized' }),
    };
  }
  // Здесь можно добавить проверку токена и прав администратора

  // Подключаемся к базе данных
  let client;
  try {
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('bhstore'); // Имя вашей базы данных

    // Получаем данные из коллекций
    const usersCollection = db.collection('users');
    const ordersCollection = db.collection('orders');

    // --- Считаем статистику ---

    // Общее количество пользователей
    const totalUsers = await usersCollection.countDocuments();

    // Общее количество заказов и сумма выручки
    const orders = await ordersCollection.find({}).toArray();
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + (order.finalPrice || order.amount || 0), 0);

    // Новые пользователи за последние 7 дней
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newUsers = await usersCollection.countDocuments({
      registeredAt: { $gte: sevenDaysAgo.toISOString() }
    });

    // Новые заказы за последние 7 дней
    const newOrders = await ordersCollection.countDocuments({
      createdAt: { $gte: sevenDaysAgo.toISOString() }
    });

    // Средний чек
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // Конверсия (процент пользователей, сделавших хотя бы один заказ)
    const usersWithOrders = await ordersCollection.aggregate([
      { $group: { _id: "$userId" } },
      { $count: "count" }
    ]).toArray();
    const uniqueBuyers = usersWithOrders[0]?.count || 0;
    const conversion = totalUsers > 0 ? Math.round((uniqueBuyers / totalUsers) * 100) : 0;

    // Формируем ответ
    const stats = {
      totalUsers,
      newUsers,
      totalOrders,
      newOrders,
      revenue: totalRevenue,
      avgOrderValue,
      conversion,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        stats,
        chartData: {
          labels: ['Пользователи', 'Заказы', 'Выручка (в тыс. ₽)'],
          values: [totalUsers, totalOrders, Math.round(totalRevenue / 1000)],
        },
      }),
    };

  } catch (error) {
    console.error('❌ Error in admin-stats function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Внутренняя ошибка сервера: ' + error.message,
      }),
    };
  } finally {
    // Всегда закрываем соединение с базой данных
    if (client) {
      await client.close();
    }
  }
};