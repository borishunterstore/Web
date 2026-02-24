const { Pool } = require('@neondatabase/serverless');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

exports.handler = async (event) => {
  console.log('👤 User function called');
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const userId = event.path.split('/').pop();
  
  if (!userId || userId === 'user') {
    return { 
      statusCode: 400, 
      headers, 
      body: JSON.stringify({ success: false, error: 'User ID required' }) 
    };
  }

  let client;
  try {
    client = await pool.connect();
    
    const result = await client.query(
      'SELECT * FROM users WHERE discord_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'User not found' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        user: result.rows[0]
      })
    };

  } catch (error) {
    console.error('❌ Error in user function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  } finally {
    if (client) client.release();
  }
};