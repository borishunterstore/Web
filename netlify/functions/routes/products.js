const router = require('express').Router();
const { sql } = require('../lib/db');
const { getTestProducts } = require('../lib/products');

router.get('/products', async (req, res) => {
  try {
    if (sql) {
      // Проверяем, не закрыт ли магазин
      const [setting] = await sql`SELECT setting_value FROM shop_settings WHERE setting_key = 'shop_open'`;
      if (setting && setting.setting_value === false) {
        return res.json({ success: false, shop_closed: true, products: [] });
      }

      const products = await sql`SELECT * FROM products ORDER BY created_at DESC`;
      
      // Если в БД есть товары — отдаем их
      if (products.length > 0) {
        return res.json({ success: true, products, source: 'database' });
      }
    }
    
    // Если БД нет или она пуста — отдаем тестовые
    const testProducts = getTestProducts();
    res.json({ success: true, products: testProducts, source: 'fallback' });
  } catch (e) {
    console.error('Ошибка получения товаров:', e);
    res.json({ success: true, products: getTestProducts(), source: 'error-fallback' });
  }
});

module.exports = router;