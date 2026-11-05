const router = require('express').Router();
const { sql } = require('../lib/db');
const { getAuthFromReq } = require('../lib/auth');

// Проверка промокода
router.post('/promocodes/check', async (req, res) => {
  try {
    const { userId, code } = req.body;
    if (!userId || !code || !sql) return res.status(400).json({ success: false });

    const [p] = await sql`SELECT * FROM promocodes WHERE LOWER(code) = LOWER(${code.trim()})`;
    
    if (!p) return res.status(404).json({ success: false, error: 'Промокод не найден' });
    if (!p.active) return res.status(400).json({ success: false, error: 'Промокод неактивен' });
    if (p.max_uses > 0 && p.used_count >= p.max_uses) return res.status(400).json({ success: false, error: 'Промокод больше недействителен' });
    
    // Проверяем дату окончания
    if (p.valid_until && new Date() > new Date(p.valid_until)) {
      return res.status(400).json({ success: false, error: 'Срок действия истёк' });
    }

    // Проверяем, использовал ли пользователь
    const usedBy = p.used_by || [];
    const uses = usedBy.filter(id => id === userId).length;
    if (uses >= (p.max_uses_per_user || 1)) {
      return res.status(400).json({ success: false, error: 'Вы уже использовали этот промокод' });
    }

    res.json({ success: true, promocode: { code: p.code, type: p.type, value: p.value } });
  } catch (e) { res.status(500).json({ success: false }); }
});

// Активация промокода
router.post('/promocodes/activate', async (req, res) => {
  try {
    const { userId, code } = req.body;
    if (!userId || !code || !sql) return res.status(400).json({ success: false });

    const [p] = await sql`SELECT * FROM promocodes WHERE LOWER(code) = LOWER(${code.trim()})`;
    if (!p) return res.status(404).json({ success: false, error: 'Промокод не найден' });

    // Записываем использование
    const usedBy = [...(p.used_by || []), userId];
    await sql`UPDATE promocodes SET used_count = used_count + 1, used_by = ${JSON.stringify(usedBy)} WHERE code = ${p.code}`;

    // Если это балансовый промокод
    if (p.type === 'balance') {
      const [u] = await sql`SELECT balance FROM users WHERE discord_id = ${userId}`;
      const newBalance = (u?.balance || 0) + p.value;
      await sql`UPDATE users SET balance = ${newBalance} WHERE discord_id = ${userId}`;
      return res.json({ success: true, type: 'balance', newBalance, value: p.value });
    }

    // Если скидка
    res.json({ success: true, type: 'discount', value: p.value, code: p.code });
  } catch (e) { res.status(500).json({ success: false }); }
});

module.exports = router;