const router = require('express').Router();
const { sql } = require('../lib/db');
const { getAuthFromReq, isAdminUserAsync } = require('../lib/auth');
const { rateLimit } = require('../lib/rateLimit');

// Мидлвар: только для админа
const adminOnly = async (req, res, next) => {
  const auth = getAuthFromReq(req);
  if (!auth) return res.status(401).json({ success: false, error: 'Не авторизован' });
  const isAdmin = await isAdminUserAsync(auth);
  if (!isAdmin) return res.status(403).json({ success: false, error: 'Доступ запрещен' });
  req.admin = auth;
  next();
};

// ==========================================
// СТАТИСТИКА
// ==========================================
router.get('/stats', adminOnly, async (req, res) => {
  try {
    if (!sql) return res.json({ success: true, stats: {} });

    const [userStats] = await sql`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN registered_at > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) as new_users
      FROM users
    `;

    // Считаем заказы через JSONB (в будущем лучше вынести в отдельную таблицу)
    const allUsers = await sql`SELECT orders FROM users`;
    
    let totalOrders = 0;
    let totalRevenue = 0;
    let newOrders = 0;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    allUsers.forEach(u => {
      const orders = u.orders || [];
      totalOrders += orders.length;
      orders.forEach(o => {
        if (o.status === 'completed' || o.status === 'pending') {
          totalRevenue += o.price || 0;
        }
        if (new Date(o.date) > weekAgo) newOrders++;
      });
    });

    const totalUsers = parseInt(userStats.total_users) || 0;
    const conversion = totalUsers > 0 ? Math.round((totalOrders / totalUsers) * 100) : 0;

    res.json({
      success: true,
      stats: {
        totalUsers,
        newUsers: parseInt(userStats.new_users) || 0,
        totalOrders,
        newOrders,
        revenue: totalRevenue,
        conversion,
        avgOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0
      }
    });
  } catch (error) {
    console.error('❌ Ошибка статистики:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ==========================================
// ПОЛЬЗОВАТЕЛИ (с пагинацией и поиском)
// ==========================================
router.get('/users', adminOnly, async (req, res) => {
  try {
    if (!sql) return res.json({ success: true, users: [], pagination: {} });

    // Параметры пагинации
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit) || 20));
    const search = (req.query.search || '').trim();
    const offset = (page - 1) * limit;

    let dbUsers, countResult;

    if (search) {
      const pattern = `%${search}%`;
      dbUsers = await sql`
        SELECT * FROM users 
        WHERE username ILIKE ${pattern} OR discord_id ILIKE ${pattern} OR email ILIKE ${pattern}
        ORDER BY registered_at DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM users 
        WHERE username ILIKE ${pattern} OR discord_id ILIKE ${pattern} OR email ILIKE ${pattern}
      `;
    } else {
      dbUsers = await sql`
        SELECT * FROM users ORDER BY registered_at DESC LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`SELECT COUNT(*) as total FROM users`;
    }

    const total = parseInt(countResult[0].total) || 0;
    const totalPages = Math.ceil(total / limit);

    const users = dbUsers.map(u => ({
      discordId: u.discord_id,
      username: u.username || 'Без имени',
      email: u.email || '',
      avatar: u.avatar,
      registeredAt: u.registered_at,
      balance: u.balance || 0,
      orderCount: (u.orders || []).length,
      badges: u.badges || {}
    }));

    res.json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('❌ Ошибка получения юзеров:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ==========================================
// ЗАКАЗЫ (с пагинацией)
// ==========================================
router.get('/orders', adminOnly, async (req, res) => {
  try {
    if (!sql) return res.json({ success: true, orders: [], pagination: {} });

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit) || 20));
    const status = req.query.status || 'all';
    const offset = (page - 1) * limit;

    const allUsers = await sql`SELECT discord_id, username, avatar, orders FROM users`;
    const allOrders = [];

    for (const u of allUsers) {
      const orders = u.orders || [];
      for (const o of orders) {
        if (status !== 'all' && o.status !== status) continue;
        allOrders.push({
          id: o.id,
          userId: u.discord_id,
          username: u.username || 'Неизвестно',
          userAvatar: u.avatar ? `https://cdn.discordapp.com/avatars/${u.discord_id}/${u.avatar}.png` : null,
          productName: o.productName,
          amount: o.price,
          date: o.date,
          status: o.status || 'pending',
          promocodes: o.promocodes || [],
          discount: o.discount || 0
        });
      }
    }

    allOrders.sort((a, b) => new Date(b.date) - new Date(a.date));

    const total = allOrders.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedOrders = allOrders.slice(offset, offset + limit);

    res.json({
      success: true,
      orders: paginatedOrders,
      pagination: {
        page, limit, total, totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('❌ Ошибка получения заказов:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ==========================================
// ОБНОВЛЕНИЕ СТАТУСА ЗАКАЗА
// ==========================================
router.put('/orders/:orderId', adminOnly, async (req, res) => {
  try {
    if (!sql) return res.status(503).json({ success: false });

    const { orderId } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'processing', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Недопустимый статус' });
    }

    const allUsers = await sql`SELECT discord_id, orders FROM users`;
    let updated = false;

    for (const u of allUsers) {
      const orders = u.orders || [];
      const idx = orders.findIndex(o => o.id === orderId);
      if (idx !== -1) {
        orders[idx].status = status;
        orders[idx].updatedAt = new Date().toISOString();
        await sql`
          UPDATE users SET orders = ${JSON.stringify(orders)} WHERE discord_id = ${u.discord_id}
        `;
        updated = true;
        break;
      }
    }

    if (!updated) return res.status(404).json({ success: false, error: 'Заказ не найден' });

    res.json({ success: true, message: 'Статус обновлен' });
  } catch (error) {
    console.error('❌ Ошибка обновления заказа:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ==========================================
// БАЛАНС
// ==========================================
router.post('/balance/add', adminOnly, async (req, res) => {
  try {
    if (!sql) return res.status(503).json({ success: false });
    const { userId, amount, reason } = req.body;

    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Неверные параметры' });
    }

    const [user] = await sql`SELECT balance FROM users WHERE discord_id = ${userId}`;
    if (!user) return res.status(404).json({ success: false, error: 'Юзер не найден' });

    const newBalance = (user.balance || 0) + parseInt(amount);

    await sql`UPDATE users SET balance = ${newBalance} WHERE discord_id = ${userId}`;

    // Транзакция
    const txId = `tx_${Date.now()}`;
    await sql`
      INSERT INTO transactions (id, user_id, amount, type, reason, admin_id, admin_name, created_at)
      VALUES (${txId}, ${userId}, ${parseInt(amount)}, 'deposit', ${reason || 'Пополнение'}, ${req.admin.id}, ${req.admin.username}, NOW())
    `;

    res.json({ success: true, newBalance });
  } catch (error) {
    console.error('❌ Ошибка пополнения:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

router.post('/balance/remove', adminOnly, async (req, res) => {
  try {
    if (!sql) return res.status(503).json({ success: false });
    const { userId, amount, reason } = req.body;

    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Неверные параметры' });
    }

    const [user] = await sql`SELECT balance FROM users WHERE discord_id = ${userId}`;
    if (!user) return res.status(404).json({ success: false, error: 'Юзер не найден' });
    if ((user.balance || 0) < amount) {
      return res.status(400).json({ success: false, error: 'Недостаточно средств' });
    }

    const newBalance = user.balance - parseInt(amount);
    await sql`UPDATE users SET balance = ${newBalance} WHERE discord_id = ${userId}`;

    const txId = `tx_${Date.now()}`;
    await sql`
      INSERT INTO transactions (id, user_id, amount, type, reason, admin_id, admin_name, created_at)
      VALUES (${txId}, ${userId}, ${parseInt(amount)}, 'withdrawal', ${reason || 'Списание'}, ${req.admin.id}, ${req.admin.username}, NOW())
    `;

    res.json({ success: true, newBalance });
  } catch (error) {
    console.error('❌ Ошибка списания:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ==========================================
// ПРОВЕРКА АДМИНА
// ==========================================
router.get('/check', async (req, res) => {
  const auth = getAuthFromReq(req);
  if (!auth) return res.json({ isAdmin: false });
  const isAdmin = await isAdminUserAsync(auth);
  res.json({ isAdmin });
});

module.exports = router;