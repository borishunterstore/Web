const router = require('express').Router();
const { sql } = require('../lib/db');
const { getAuthFromReq } = require('../lib/auth');

// Получить отзывы
router.get('/reviews', async (req, res) => {
  try {
    if (!sql) return res.json({ success: true, reviews: [], stats: { averageRating: 0, totalReviews: 0 } });
    
    const reviews = await sql`SELECT * FROM reviews ORDER BY created_at DESC LIMIT 50`;
    
    // Считаем статистику
    let totalRating = 0;
    reviews.forEach(r => totalRating += r.rating);
    const averageRating = reviews.length > 0 ? (totalRating / reviews.length).toFixed(1) : 0;

    res.json({
      success: true,
      reviews,
      stats: { averageRating: parseFloat(averageRating), totalReviews: reviews.length }
    });
  } catch (e) { res.status(500).json({ success: false }); }
});

// Создать отзыв
router.post('/reviews', async (req, res) => {
  try {
    const auth = getAuthFromReq(req);
    const { productId, productName, rating, text } = req.body;
    
    if (!auth) return res.status(401).json({ success: false, error: 'Авторизуйтесь' });
    if (!text || text.length < 10) return res.status(400).json({ success: false, error: 'Текст слишком короткий' });
    if (!sql) return res.status(503).json({ success: false });

    const id = `rev_${Date.now()}`;
    const now = new Date().toISOString();

    await sql`
      INSERT INTO reviews (id, user_id, name, avatar, product_id, product_name, rating, text, created_at, updated_at)
      VALUES (${id}, ${auth.id}, ${auth.username}, ${auth.avatar}, ${productId}, ${productName}, ${rating}, ${text}, ${now}, ${now})
    `;

    res.json({ success: true, message: 'Отзыв добавлен' });
  } catch (e) {
    console.error('Ошибка создания отзыва:', e);
    res.status(500).json({ success: false });
  }
});

module.exports = router;