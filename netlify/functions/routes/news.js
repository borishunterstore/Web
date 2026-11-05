const router = require('express').Router();
const { sql } = require('../lib/db');

// Получить список новостей
router.get('/news', async (req, res) => {
  try {
    if (!sql) return res.json({ success: true, news: [] });
    
    const news = await sql`SELECT * FROM news ORDER BY created_at DESC LIMIT 20`;
    
    // Форматируем дату для фронтенда
    const formatted = news.map(item => ({
      ...item,
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : new Date(item.created_at).toISOString().split('T')[0]
    }));
    
    res.json({ success: true, news: formatted });
  } catch (e) {
    console.error('Ошибка новостей:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Получить одну новость по ID
router.get('/news/:id', async (req, res) => {
  try {
    if (!sql) return res.status(503).json({ success: false });
    const newsId = parseInt(req.params.id);
    
    const [newsItem] = await sql`SELECT * FROM news WHERE id = ${newsId}`;
    if (!newsItem) return res.status(404).json({ success: false, error: 'Новость не найдена' });

    // Увеличиваем счетчик просмотров
    await sql`UPDATE news SET views = views + 1 WHERE id = ${newsId}`;

    res.json({ success: true, news: newsItem });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

module.exports = router;