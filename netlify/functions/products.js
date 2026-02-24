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
  console.log('🛍️ Products function called');
  
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
      SELECT * FROM products 
      ORDER BY created_at DESC
    `);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        products: result.rows,
        total: result.rows.length
      })
    };

  } catch (error) {
    console.error('❌ Error in products function:', error);
    
    // Демо-данные
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        products: [
          {
            id: 'premium_month',
            name: 'Премиум на 1 месяц',
            description: 'Доступ ко всем премиум функциям на 30 дней',
            price: 299,
            category: 'premium',
            icon: 'fas fa-crown',
            popular: true
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