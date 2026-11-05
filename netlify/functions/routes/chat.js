const router = require('express').Router();
const { sql } = require('../lib/db');
const { getAuthFromReq, isAdminUserAsync } = require('../lib/auth');
const { chatLimiter } = require('../lib/rateLimit');

router.get('/messages/:userId', async (req, res) => {
  const d = getAuthFromReq(req);
  if (!d) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const isAdmin = await isAdminUserAsync(d);
  if (d.id !== req.params.userId && !isAdmin)
    return res.status(403).json({ success: false, error: 'Forbidden' });

  if (!sql) return res.json({ success: true, messages: [] });

  const [rows] = await sql`
    SELECT id, message, from_admin, read, timestamp
    FROM messages
    WHERE user_id = ${req.params.userId}
    ORDER BY timestamp DESC
    LIMIT 100
  `;
  res.json({ success: true, messages: (rows || []).reverse() });
});

router.get('/check', async (req, res) => {
  const d = getAuthFromReq(req);
  if (!d) return res.status(401).json({ success: false, error: 'Unauthorized' });
  if (!sql) return res.json({ success: true, hasNew: false });

  const since = new Date(parseInt(req.query.since || '0')).toISOString();
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

  const [r] = await sql`
    SELECT COUNT(*)::int AS n FROM messages
    WHERE user_id = ${userId} AND timestamp > ${since}
  `;
  res.json({ success: true, hasNew: r.n > 0, newCount: r.n });
});

module.exports = router;