// netlify/functions/admin-chat-users.js
const { neon } = require('@neondatabase/serverless');

exports.handler = async (event, context) => {
  // Настройки CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // OPTIONS запрос (preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }

  try {
    // Проверка авторизации
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Не авторизован' })
      };
    }

    const token = authHeader.replace('Bearer ', '');
    
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      
      // Проверка прав администратора
      const isAdmin = decoded.id === '992442453833547886';
      if (!isAdmin) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ success: false, error: 'Требуются права администратора' })
        };
      }
      
      // Подключение к Neon
      if (!process.env.DATABASE_URL) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: 'DATABASE_URL не установлен' })
        };
      }
      
      const sql = neon(process.env.DATABASE_URL);
      
      // Получаем всех пользователей
      const dbUsers = await sql`
        SELECT discord_id, username, email, avatar, balance, badges, orders, registered_at 
        FROM users 
        ORDER BY registered_at DESC
      `;
      
      // Получаем непрочитанные сообщения для каждого пользователя
      const usersWithMessages = await Promise.all(dbUsers.map(async (user) => {
        try {
          const messages = await sql`
            SELECT COUNT(*) as count FROM messages 
            WHERE user_id = ${user.discord_id} 
            AND from_admin = false 
            AND read = false
          `;
          
          const orders = user.orders || [];
          const lastOrder = orders.length > 0 ? orders[orders.length - 1]?.date : null;
          
          return {
            discordId: user.discord_id,
            username: user.username,
            email: user.email || '',
            avatar: user.avatar,
            registeredAt: user.registered_at,
            balance: user.balance || 0,
            orderCount: orders.length,
            lastOrder: lastOrder,
            badges: user.badges || {},
            unreadMessages: parseInt(messages[0]?.count || 0)
          };
        } catch (err) {
          console.error(`Ошибка обработки пользователя ${user.discord_id}:`, err);
          return {
            discordId: user.discord_id,
            username: user.username,
            email: user.email || '',
            avatar: user.avatar,
            registeredAt: user.registered_at,
            balance: user.balance || 0,
            orderCount: 0,
            lastOrder: null,
            badges: user.badges || {},
            unreadMessages: 0
          };
        }
      }));
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          users: usersWithMessages,
          total: usersWithMessages.length
        })
      };
      
    } catch (decodeError) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Неверный токен' })
      };
    }
    
  } catch (error) {
    console.error('❌ Ошибка получения пользователей чата:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Ошибка сервера',
        details: error.message 
      })
    };
  }
};