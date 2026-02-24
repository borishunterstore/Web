const { Pool } = require('pg');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  let client;
  try {
    client = await pool.connect();

    // GET /admin-products - получение всех товаров
    if (event.httpMethod === 'GET') {
      const result = await client.query('SELECT * FROM products ORDER BY created_at DESC');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, products: result.rows }),
      };
    }

    // POST /admin-products - создание нового товара
    if (event.httpMethod === 'POST') {
      const { id, name, description, price, category, icon, features, popular } = JSON.parse(event.body);

      const result = await client.query(
        `INSERT INTO products (id, name, description, price, category, icon, features, popular, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         RETURNING *`,
        [id, name, description, price, category, icon, features || [], popular || false]
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, product: result.rows[0] }),
      };
    }

    // PUT /admin-products/:id - обновление товара
    if (event.httpMethod === 'PUT') {
      const productId = event.path.split('/').pop();
      const { name, description, price, category, icon, features, popular } = JSON.parse(event.body);

      const result = await client.query(
        `UPDATE products
         SET name = $1, description = $2, price = $3, category = $4, icon = $5, features = $6, popular = $7
         WHERE id = $8
         RETURNING *`,
        [name, description, price, category, icon, features, popular, productId]
      );

      if (result.rows.length === 0) {
        return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'Product not found' }) };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, product: result.rows[0] }),
      };
    }

    // DELETE /admin-products/:id - удаление товара
    if (event.httpMethod === 'DELETE') {
      const productId = event.path.split('/').pop();

      const result = await client.query('DELETE FROM products WHERE id = $1 RETURNING id', [productId]);

      if (result.rows.length === 0) {
        return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'Product not found' }) };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Product deleted' }),
      };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method Not Allowed' }) };

  } catch (error) {
    console.error('❌ Error in admin-products:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  } finally {
    if (client) client.release();
  }
};