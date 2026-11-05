const router = require('express').Router();
const { sql } = require('../lib/db');
const { getAuthFromReq } = require('../lib/auth');

router.post('/check', async (req, res) => {
  try {
    const { userId, code } = req.body;
    if (!userId || !code) return res.status(400).json({ success: false, error: 'Missing params' });
    if (!sql) return res.status(503).json({ success: false, error: 'DB unavailable' });

    const [p] = await sql`SELECT * FROM promocodes WHERE LOWER(code) = LOWER(${code.trim()})`;
    if (!p) return res.status(404).json({ success: false, error: 'Промокод не найден' });
    if (!p.active) return res.status(400).json({ success: false, error: 'Промокод неактивен' });
    if (p.max_uses > 0 && p.used_count >= p.max_uses)
      return res.status(400).json({ success: false, error: 'Промокод больше недействителен' });
    if (p.valid_until && new Date() > new Date(p.valid_until))
      return res.status(400).json({ success: false, error: 'Срок истёк' });

    const usedBy = p.used_by || [];
    const uses = usedBy.filter((id) => id === userId).length;
    if (uses >= (p.max_uses_per_user || 1))
      return res.status(400).json({ success: false, error: 'Вы уже использовали этот промокод' });

    res.json({
      success: true,
      promocode: { code: p.code, type: p.type, value: p.value },
    });
  } catch (e) {
    console.error('POST /promocodes/check:', e.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/activate', async (req, res) => {
  try {
    const { userId, code } = req.body;
    if (!userId || !code) return res.status(400).json({ success: false, error: 'Missing params' });
    if (!sql) return res.status(503).json({ success: false, error: 'DB unavailable' });

    // ✅ Транзакция — атомарная проверка + запись
    const result = await sql.begin(async (tx) => {
      const [p] = await tx`
        SELECT * FROM promocodes
        WHERE LOWER(code) = LOWER(${code.trim()})
        FOR UPDATE
      `;
      if (!p) throw new Error('NOT_FOUND');
      if (!p.active) throw new Error('INACTIVE');
      if (p.max_uses > 0 && p.used_count >= p.max_uses) throw new Error('MAXED');
      if (p.valid_until && new Date() > new Date(p.valid_until)) throw new Error('EXPIRED');

      const usedBy = [...(p.used_by || []), userId];
      await tx`
        UPDATE promocodes
        SET used_count = used_count + 1, used_by = ${JSON.stringify(usedBy)}, updated_at = NOW()
        WHERE code = ${p.code}
      `;

      if (p.type === 'balance') {
        const [u] = await tx`SELECT balance FROM users WHERE discord_id = ${userId} FOR UPDATE`;
        const newBalance = (u?.balance || 0) + p.value;
        await tx`UPDATE users SET balance = ${newBalance} WHERE discord_id = ${userId}`;
        return { type: 'balance', value: p.value, newBalance };
      }
      return { type: p.type, value: p.value, code: p.code };
    });

    res.json({ success: true, ...result });
  } catch (e) {
    const map = {
      NOT_FOUND: [404, 'Промокод не найден'],
      INACTIVE: [400, 'Промокод неактивен'],
      MAXED: [400, 'Промокод больше недействителен'],
      EXPIRED: [400, 'Срок истёк'],
    };
    const [code, msg] = map[e.message] || [500, 'Server error'];
    res.status(code).json({ success: false, error: msg });
  }
});

module.exports = router;