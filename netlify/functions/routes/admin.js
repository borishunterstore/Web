const router = require('express').Router();
const { sql } = require('../lib/db');
const { getAuthFromReq, isAdminUserAsync } = require('../lib/auth');

// Мидлвар для проверки админа
const checkAdmin = async (req, res, next) => {
  const d = getAuthFromReq(req);
  if (!d) return res.status(401).json({ success: false });
  const isAdmin = await isAdminUserAsync(d);
  if (!isAdmin) return res.status(403).json({ success: false, error: 'Access denied' });
  req.admin = d;
  next();
};

router.get('/check', async (req, res) => {
  const d = getAuthFromReq(req);
  if (!d) return res.json({ isAdmin: false });
  const isAdmin = await isAdminUserAsync(d);
  res.json({ isAdmin });
});

router.get('/stats', checkAdmin, async (req, res) => {
  if (!sql) return res.json({ success: true, stats: {} });
  const [users] = await sql`SELECT COUNT(*) as count FROM users`;
  const [orders] = await sql`SELECT SUM((o->>'price')::int) as total FROM users, jsonb_array_elements(orders) o`;
  
  res.json({
    success: true,
    stats: {
      totalUsers: parseInt(users.count) || 0,
      totalOrders: 0,
      revenue: parseInt(orders.total) || 0,
    }
  });
});

router.get('/users', checkAdmin, async (req, res) => {
  if (!sql) return res.json({ success: true, users: [] });
  const users = await sql`SELECT * FROM users ORDER BY registered_at DESC`;
  res.json({ success: true, users });
});

// Товары
router.post('/products', checkAdmin, async (req, res) => {
  if (sql) await sql`INSERT INTO products (id, name, price, description) VALUES (${req.body.id}, ${req.body.name}, ${req.body.price}, ${req.body.description}) ON CONFLICT (id) DO UPDATE SET name = ${req.body.name}, price = ${req.body.price}, description = ${req.body.description}`;
  res.json({ success: true });
});

// Новости
router.post('/news', checkAdmin, async (req, res) => {
  if (sql) await sql`INSERT INTO news (title, content, category) VALUES (${req.body.title}, ${req.body.content}, ${req.body.category})`;
  res.json({ success: true });
});

module.exports = router;