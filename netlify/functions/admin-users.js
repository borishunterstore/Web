const { Pool } = require('pg');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method Not Allowed' }) };
  }

  let client;
  try {
    client = await pool.connect();

    // Получаем всех пользователей с количеством их заказов
    const result = await client.query(`
      SELECT 
        u.discord_id, u.username, u.avatar, u.email, u.balance, u.created_at,
        u.badges,
        COUNT(o.id) as order_count,
        COALESCE(SUM(o.final_price), 0) as total_spent
      FROM users u
      LEFT JOIN orders o ON u.discord_id = o.user_id AND o.status = 'completed'
      GROUP BY u.discord_id
      ORDER BY u.created_at DESC
    `);

    const users = result.rows.map(row => ({
      discordId: row.discord_id,
      username: row.username,
      avatar: row.avatar,
      email: row.email,
      balance: parseFloat(row.balance) || 0,
      registeredAt: row.created_at,
      orderCount: parseInt(row.order_count),
      totalSpent: parseFloat(row.total_spent),
      badges: row.badges || {},
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, users, total: users.length }),
    };

  } catch (error) {
    console.error('❌ Error in admin-users:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  } finally {
    if (client) client.release();
  }
};