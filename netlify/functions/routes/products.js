const router = require('express').Router();
const { sql } = require('../lib/db');
const path = require('path');
const fs = require('fs');

// Fallback, если БД нет
const PRODUCTS_JSON = path.join(__dirname, '../../data/products.json');
let fallbackProducts = [];
try {
  if (fs.existsSync(PRODUCTS_JSON)) {
    fallbackProducts = JSON.parse(fs.readFileSync(PRODUCTS_JSON, 'utf8'));
  }
} catch (e) {
  console.error('products.json read:', e.message);
}

router.get('/', async (req, res) => {
  try {
    // 1. Проверка "магазин закрыт"
    if (sql) {
      const [s] = await sql`SELECT setting_value FROM shop_settings WHERE setting_key='shop_open'`;
      if (s && s.setting_value === false) {
        return res.json({ success: false, shop_closed: true, products: [], total: 0 });
      }
    }

    // 2. Всегда берём из БД, если есть данные (иначе — из JSON)
    if (sql) {
      const rows = await sql`SELECT * FROM products ORDER BY created_at DESC`;
      if (rows.length > 0) {
        return res.json({ success: true, products: rows, total: rows.length, source: 'db' });
      }
    }

    res.json({ success: true, products: fallbackProducts, total: fallbackProducts.length, source: 'json' });
  } catch (e) {
    console.error('GET /products:', e.message);
    res.json({ success: true, products: fallbackProducts, total: fallbackProducts.length, source: 'json-fallback' });
  }
});

module.exports = router;