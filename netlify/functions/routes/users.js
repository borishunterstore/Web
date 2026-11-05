const router = require('express').Router();
const { sql } = require('../lib/db');
const { getAuthFromReq } = require('../lib/auth');

router.get('/me', async (req, res) => {
  const d = getAuthFromReq(req);
  if (!d) return res.status(401).json({ success: false, error: 'Unauthorized' });
  if (!sql) {
    return res.json({
      success: true,
      user: { discordId: d.id, username: d.username || 'User', email: d.email, avatar: d.avatar, balance: 0, badges: {}, orders: [] },
    });
  }
  try {
    let [u] = await sql`
      SELECT discord_id, username, email, avatar, registered_at, balance, badges, orders, privacy, frozen
      FROM users WHERE discord_id = ${d.id}
    `;
    if (!u) {
      await sql`
        INSERT INTO users (discord_id, username, email, avatar)
        VALUES (${d.id}, ${d.username}, ${d.email}, ${d.avatar})
      `;
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
  } catch (e) {
    console.error('GET /user/me:', e.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;