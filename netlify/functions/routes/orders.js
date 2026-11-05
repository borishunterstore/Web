const router = require('express').Router();
const { sql } = require('../lib/db');
const { getAuthFromReq } = require('../lib/auth');
const { orderLimiter } = require('../lib/rateLimit');
const { send } = require('../lib/webhooks');

router.post('/create-order', orderLimiter, async (req, res) => {
  try {
    const { userId, productId, productName, price, originalPrice, promocodes, discount } = req.body;
    if (!userId || !productId) return res.status(400).json({ success: false, error: 'Missing fields' });
    if (!sql) return res.status(503).json({ success: false, error: 'DB unavailable' });

    const [product] = await sql`SELECT price, name FROM products WHERE id = ${productId}`;
    const basePrice = product ? product.price : price;
    const finalPrice = Math.round(basePrice * (100 - (discount || 0)) / 100);

    const [user] = await sql`SELECT balance, orders FROM users WHERE discord_id = ${userId}`;
    if (!user || user.balance < finalPrice) return res.status(400).json({ success: false, error: 'Недостаточно средств' });

    const newBalance = user.balance - finalPrice;
    const orderId = `BH-${Date.now()}`;
    const order = { id: orderId, productId, productName: product?.name || productName, price: finalPrice, originalPrice: basePrice, discount, promocodes, date: new Date().toISOString(), status: 'pending' };

    const orders = user.orders || [];
    orders.push(order);

    await sql`UPDATE users SET balance = ${newBalance}, orders = ${JSON.stringify(orders)} WHERE discord_id = ${userId}`;

    send('purchase', { embeds: [{ title: '💰 Новая покупка', description: `Пользователь купил ${order.productName}`, color: 0x57F287 }] });

    res.json({ success: true, orderId, newBalance });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;