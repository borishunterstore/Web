const { Pool } = require('@neondatabase/serverless');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

exports.handler = async (event) => {
  console.log('📰 News function called');
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { 
      statusCode: 405, 
      headers, 
      body: JSON.stringify({ success: false, error: 'Method Not Allowed' }) 
    };
  }

  let client;
  try {
    client = await pool.connect();
    
    const result = await client.query(`
      SELECT * FROM news 
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        news: result.rows,
        total: result.rows.length
      })
    };

  } catch (error) {
    console.error('❌ Error in news function:', error);
    
    // Если таблицы нет, возвращаем демо-данные
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        news: [
          {
            id: 1,
            title: 'Добро пожаловать в BHStore!',
            content: 'Магазин успешно запущен.',
            date: new Date().toISOString().split('T')[0],
            category: 'announcement'
          }
        ],
        total: 1,
        notice: 'Using demo data - database table not found'
      })
    };
  } finally {
    if (client) client.release();
  }
};