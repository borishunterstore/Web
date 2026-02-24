const { Pool } = require('pg');

// Настройки CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Создаем пул подключений к базе данных
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Обязательно для Neon
});

exports.handler = async (event) => {
  // Обработка preflight-запроса OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method Not Allowed' }),
    };
  }

  let client;
  try {
    client = await pool.connect();

    // Получаем статистику
    const userStats = await client.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_users
      FROM users
    `);

    const orderStats = await client.query(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(final_price), 0) as total_revenue,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_orders
      FROM orders
      WHERE status = 'completed'
    `);

    // Количество уникальных покупателей
    const buyerStats = await client.query(`
      SELECT COUNT(DISTINCT user_id) as unique_buyers FROM orders WHERE status = 'completed'
    `);

    const totalUsers = parseInt(userStats.rows[0].total_users) || 0;
    const totalOrders = parseInt(orderStats.rows[0].total_orders) || 0;
    const totalRevenue = parseFloat(orderStats.rows[0].total_revenue) || 0;
    const newUsers = parseInt(userStats.rows[0].new_users) || 0;
    const newOrders = parseInt(orderStats.rows[0].new_orders) || 0;
    const uniqueBuyers = parseInt(buyerStats.rows[0].unique_buyers) || 0;

    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    const conversion = totalUsers > 0 ? Math.round((uniqueBuyers / totalUsers) * 100) : 0;

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
      body: JSON.stringify({ success: true, stats }),
    };

  } catch (error) {
    console.error('❌ Error in admin-stats:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  } finally {
    if (client) client.release();
  }
};