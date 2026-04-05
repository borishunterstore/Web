const { neon } = require('@neondatabase/serverless');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

let sql;
if (process.env.DATABASE_URL) {
  sql = neon(process.env.DATABASE_URL);
}

exports.handler = async (event) => {
  console.log('NEWS Loading');
  
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

  try {
    if (sql) {
      try {
        const result = await sql`
          SELECT * FROM news 
          ORDER BY created_at DESC 
          LIMIT 10
        `;
        
        if (result && result.length > 0) {
          console.log(`Загружено ${result.length} новостей из БД`);
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              news: result,
              total: result.length
            })
          };
        }
      } catch (dbError) {
        console.error('❌ Ошибка БД:', dbError.message);
      }
    }
    
    console.log('📝 Используем демо-новости');
    const demoNews = [
      {
        id: 1,
        title: 'Добро пожаловать в BHStore!',
        content: 'Мы рады приветствовать вас в нашем магазине! BHStore - это современный Discord магазин с широким выбором товаров и услуг. У нас вы найдете премиум подписки, игровые валюты и многое другое. Приятных покупок!',
        date: new Date().toISOString().split('T')[0],
        category: 'announcement',
        views: 156,
        tags: ['welcome', 'new', 'bhstore'],
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        title: 'Запуск системы отзывов',
        content: 'Мы запустили новую систему отзывов! Теперь вы можете оценивать товары и делиться своим мнением с другими покупателями. Лучшие отзывы будут получать бонусы на баланс!',
        date: new Date(Date.now() - 2*24*60*60*1000).toISOString().split('T')[0],
        category: 'updates',
        views: 89,
        tags: ['reviews', 'update', 'features'],
        created_at: new Date(Date.now() - 2*24*60*60*1000).toISOString()
      },
      {
        id: 3,
        title: 'Новогодняя распродажа!',
        content: 'Скидки до 50% на все премиум подписки! Успейте приобрести товары по выгодным ценам. Акция действует до 15 января.',
        date: new Date(Date.now() - 5*24*60*60*1000).toISOString().split('T')[0],
        category: 'promo',
        views: 234,
        tags: ['sale', 'discount', 'newyear'],
        created_at: new Date(Date.now() - 5*24*60*60*1000).toISOString()
      },
      {
        id: 4,
        title: 'Обновление магазина',
        content: 'Добавлены новые товары: Discord боты, настройка серверов и многое другое! Заходите в магазин, чтобы ознакомиться с ассортиментом.',
        date: new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0],
        category: 'updates',
        views: 67,
        tags: ['update', 'new-products'],
        created_at: new Date(Date.now() - 7*24*60*60*1000).toISOString()
      },
      {
        id: 5,
        title: 'Ближайшие ивенты',
        content: 'Скоро состоится розыгрыш призов среди активных покупателей. Следите за новостями, чтобы не пропустить!',
        date: new Date(Date.now() - 10*24*60*60*1000).toISOString().split('T')[0],
        category: 'events',
        views: 45,
        tags: ['events', 'giveaway'],
        created_at: new Date(Date.now() - 10*24*60*60*1000).toISOString()
      }
    ];
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        news: demoNews,
        total: demoNews.length
      })
    };

  } catch (error) {
    console.error('❌ Ошибка в news function:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        news: [],
        total: 0
      })
    };
  }
};