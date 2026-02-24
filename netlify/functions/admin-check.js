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
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: 'Unauthorized' }) };
    }

    const token = authHeader.replace('Bearer ', '');
    // Декодируем токен (упрощенно, в реальном проекте нужна проверка JWT)
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());

    client = await pool.connect();

    // Проверяем в базе, является ли пользователь администратором
    const result = await client.query(
      'SELECT badges FROM users WHERE discord_id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'User not found' }) };
    }

    const badges = result.rows[0].badges || {};
    const isAdmin = badges.admin === true || badges.partner === true;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, isAdmin }),
    };

  } catch (error) {
    console.error('❌ Error in admin-check:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  } finally {
    if (client) client.release();
  }
};