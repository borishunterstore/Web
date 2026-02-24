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

    const result = await client.query(`
      SELECT 
        o.id, o.user_id, o.product_name, o.product_id, o.original_price,
        o.final_price, o.discount, o.promocodes, o.status, o.created_at,
        u.username, u.avatar
      FROM orders o
      JOIN users u ON o.user_id = u.discord_id
      ORDER BY o.created_at DESC
    `);

    const orders = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      username: row.username,
      userAvatar: row.avatar,
      productName: row.product_name,
      productId: row.product_id,
      originalPrice: parseFloat(row.original_price),
      finalPrice: parseFloat(row.final_price),
      discount: row.discount,
      promocodes: row.promocodes || [],
      status: row.status,
      createdAt: row.created_at,
    }));

    const totalRevenue = orders.reduce((sum, o) => sum + o.finalPrice, 0);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        orders,
        total: orders.length,
        totalRevenue,
      }),
    };

  } catch (error) {
    console.error('❌ Error in admin-orders:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  } finally {
    if (client) client.release();
  }
};