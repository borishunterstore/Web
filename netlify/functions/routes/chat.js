const router = require('express').Router();
const { sql } = require('../lib/db');
const { getAuthFromReq, isAdminUserAsync } = require('../lib/auth');
const { send } = require('../lib/webhooks');

router.get('/messages/:userId', async (req, res) => {
  const d = getAuthFromReq(req);
  if (!d) return res.status(401).json({ success: false });
  const isAdmin = await isAdminUserAsync(d);
  if (d.id !== req.params.userId && !isAdmin) return res.status(403).json({ success: false });
  if (!sql) return res.json({ success: true, messages: [] });

  const messages = await sql`SELECT * FROM messages WHERE user_id = ${req.params.userId} ORDER BY timestamp ASC LIMIT 100`;
  res.json({ success: true, messages });
});

router.post('/send', async (req, res) => {
  const d = getAuthFromReq(req);
  if (!d) return res.status(401).json({ success: false });
  const { userId, message, fromAdmin } = req.body;
  if (!userId || !message) return res.status(400).json({ success: false });
  if (!sql) return res.status(503).json({ success: false });

  const msgId = `msg_${Date.now()}`;
  await sql`INSERT INTO messages (id, user_id, message, from_admin, read) VALUES (${msgId}, ${userId}, ${message}, ${fromAdmin || false}, ${!fromAdmin})`;

  if (!fromAdmin) {
    send('chat', { embeds: [{ title: '💬 Новое сообщение', description: message, color: 0x5865F2 }] });
  }

  res.json({ success: true, messageId: msgId });
});

module.exports = router;