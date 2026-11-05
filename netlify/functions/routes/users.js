const router = require('express').Router();
const { sql } = require('../lib/db');
const { getAuthFromReq, isAdminUserAsync } = require('../lib/auth');

// Мой профиль
router.get('/me', async (req, res) => {
  const d = getAuthFromReq(req);
  if (!d) return res.status(401).json({ success: false });
  if (!sql) return res.json({ success: true, user: { discordId: d.id, username: d.username, avatar: d.avatar, balance: 0, badges: {} } });

  try {
    let [u] = await sql`SELECT * FROM users WHERE discord_id = ${d.id}`;
    if (!u) {
      await sql`INSERT INTO users (discord_id, username, email, avatar) VALUES (${d.id}, ${d.username}, ${d.email}, ${d.avatar})`;
      [u] = await sql`SELECT * FROM users WHERE discord_id = ${d.id}`;
    }
    res.json({
      success: true,
      user: {
        discordId: u.discord_id, username: u.username, email: u.email, avatar: u.avatar,
        registeredAt: u.registered_at, balance: u.balance || 0,
        badges: u.badges || {}, orders: u.orders || [], privacy: u.privacy || {}, frozen: u.frozen || false,
      },
    });
  } catch (e) { res.status(500).json({ success: false }); }
});

// Баланс
router.get('/:id/balance', async (req, res) => {
  if (!sql) return res.json({ success: true, balance: 0 });
  try {
    const [u] = await sql`SELECT balance FROM users WHERE discord_id = ${req.params.id}`;
    res.json({ success: true, balance: u?.balance || 0 });
  } catch { res.status(500).json({ success: false }); }
});

// Заказы
router.get('/:id/orders', async (req, res) => {
  const d = getAuthFromReq(req);
  if (!d || (d.id !== req.params.id && !(await isAdminUserAsync(d)))) {
    return res.status(403).json({ success: false });
  }
  if (!sql) return res.json({ success: true, orders: [] });
  try {
    const [u] = await sql`SELECT orders FROM users WHERE discord_id = ${req.params.id}`;
    res.json({ success: true, orders: u?.orders || [] });
  } catch { res.status(500).json({ success: false }); }
});

// Обновление приватности
router.put('/:userId/privacy', async (req, res) => {
  const d = getAuthFromReq(req);
  if (!d || d.id !== req.params.userId) return res.status(403).json({ success: false });
  if (sql) await sql`UPDATE users SET privacy = ${JSON.stringify(req.body.privacy)} WHERE discord_id = ${req.params.userId}`;
  res.json({ success: true });
});

// Заморозка
router.post('/freeze', async (req, res) => {
  const d = getAuthFromReq(req);
  if (!d || d.id !== req.body.userId) return res.status(403).json({ success: false });
  if (sql) await sql`UPDATE users SET frozen = true WHERE discord_id = ${req.body.userId}`;
  res.json({ success: true });
});

module.exports = router;