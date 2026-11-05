const router = require('express').Router();
const { sql } = require('../lib/db');
const { getAuthFromReq } = require('../lib/auth');
const { orderLimiter } = require('../lib/rateLimit');
const { send } = require('../lib/webhooks');

/**
 * POST /api/create-order
 * Создание заказа с ПОЛНОЙ серверной валидацией цен и промокодов.
 */
router.post('/create-order', orderLimiter, async (req, res) => {
  try {
    const auth = getAuthFromReq(req);
    if (!auth) return res.status(401).json({ success: false, error: 'Авторизуйтесь' });
    if (!sql) return res.status(503).json({ success: false, error: 'База данных недоступна' });

    const { productId, promocodes: rawPromocodes } = req.body;
    const userId = auth.id;

    if (!productId) {
      return res.status(400).json({ success: false, error: 'Не указан ID товара' });
    }

    // 1. Получаем товар из БД (ИГНОРИРУЕМ цену с клиента)
    const [product] = await sql`SELECT * FROM products WHERE id = ${productId}`;
    if (!product) {
      return res.status(404).json({ success: false, error: 'Товар не найден' });
    }

    const originalPrice = product.price;

    // 2. Проверяем промокоды (если присланы)
    let totalDiscountPercent = 0;
    const appliedPromocodes = [];
    const promocodesToMark = [];

    if (Array.isArray(rawPromocodes) && rawPromocodes.length > 0) {
      const codes = rawPromocodes.map(c => String(c).toUpperCase().trim());

      const dbPromocodes = await sql`
        SELECT * FROM promocodes 
        WHERE UPPER(code) = ANY(${codes})
      `;

      for (const p of dbPromocodes) {
        // Проверяем активность и лимиты
        if (!p.active) continue;
        if (p.max_uses > 0 && p.used_count >= p.max_uses) continue;
        if (p.valid_until && new Date() > new Date(p.valid_until)) continue;
        
        // Проверяем, не использовал ли уже юзер
        const usedBy = p.used_by || [];
        const userUses = usedBy.filter(id => id === userId).length;
        if (userUses >= (p.max_uses_per_user || 1)) continue;

        // Проверяем, применим ли к этому товару
        const productIds = p.product_ids || [];
        if (productIds.length > 0 && !productIds.includes(productId)) continue;

        if (p.type === 'discount') {
          totalDiscountPercent += p.value;
          appliedPromocodes.push(p.code);
          promocodesToMark.push(p);
        }
      }
    }

    // Ограничиваем максимальную скидку 90%
    totalDiscountPercent = Math.min(totalDiscountPercent, 90);
    
    const discountAmount = Math.round(originalPrice * (totalDiscountPercent / 100));
    const finalPrice = originalPrice - discountAmount;

    // 3. Проверяем баланс пользователя
    const [user] = await sql`SELECT balance, orders FROM users WHERE discord_id = ${userId}`;
    if (!user) return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    if (user.balance < finalPrice) {
      return res.status(400).json({ 
        success: false, 
        error: `Недостаточно средств. Нужно: ${finalPrice} ₽, у вас: ${user.balance} ₽` 
      });
    }

    // 4. Списываем баланс
    const newBalance = user.balance - finalPrice;

    // 5. Создаем заказ
    const orderId = `BH-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const newOrder = {
      id: orderId,
      productId: product.id,
      productName: product.name,
      price: finalPrice,
      originalPrice: originalPrice,
      discount: totalDiscountPercent,
      discountAmount: discountAmount,
      promocodes: appliedPromocodes,
      date: new Date().toISOString(),
      status: 'pending'
    };

    const orders = user.orders || [];
    orders.push(newOrder);

    // Обновляем юзера
    const badges = (await sql`SELECT badges FROM users WHERE discord_id = ${userId}`)[0]?.badges || {};
    badges.buyer = true;

    await sql`
      UPDATE users 
      SET balance = ${newBalance}, orders = ${JSON.stringify(orders)}, badges = ${JSON.stringify(badges)}
      WHERE discord_id = ${userId}
    `;

    // 6. Сжигаем промокоды
    for (const promo of promocodesToMark) {
      const usedBy = [...(promo.used_by || []), userId];
      await sql`
        UPDATE promocodes 
        SET used_count = used_count + 1, used_by = ${JSON.stringify(usedBy)}, updated_at = NOW()
        WHERE code = ${promo.code}
      `;
    }

    // 7. Отправляем вебхук
    send('purchase', {
      embeds: [{
        title: '💰 Новая покупка!',
        description: `<@${userId}> купил **${product.name}**`,
        color: 0xE59425,
        fields: [
          { name: 'Цена', value: `${finalPrice} ₽`, inline: true },
          { name: 'Заказ', value: orderId, inline: true },
          { name: 'Баланс после', value: `${newBalance} ₽`, inline: true }
        ],
        timestamp: new Date().toISOString()
      }]
    });

    res.json({
      success: true,
      orderId,
      newBalance,
      finalPrice,
      discount: totalDiscountPercent
    });

  } catch (error) {
    console.error('❌ Ошибка создания заказа:', error);
    res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * POST /api/orders/:orderId/cancel
 * Отмена заказа с возвратом средств.
 */
router.post('/orders/:orderId/cancel', async (req, res) => {
  try {
    const auth = getAuthFromReq(req);
    if (!auth) return res.status(401).json({ success: false, error: 'Авторизуйтесь' });
    if (!sql) return res.status(503).json({ success: false, error: 'БД недоступна' });

    const orderId = req.params.orderId;
    const userId = auth.id;

    const [user] = await sql`SELECT balance, orders FROM users WHERE discord_id = ${userId}`;
    if (!user) return res.status(404).json({ success: false, error: 'Пользователь не найден' });

    const orders = user.orders || [];
    const orderIndex = orders.findIndex(o => o.id === orderId);

    if (orderIndex === -1) return res.status(404).json({ success: false, error: 'Заказ не найден' });
    
    const order = orders[orderIndex];
    if (order.status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'Заказ уже отменен' });
    }
    if (order.status === 'completed') {
      return res.status(400).json({ success: false, error: 'Нельзя отменить выполненный заказ' });
    }

    // Возврат средств
    const refundAmount = order.price || 0;
    const newBalance = user.balance + refundAmount;

    orders[orderIndex].status = 'cancelled';
    orders[orderIndex].cancelledAt = new Date().toISOString();

    await sql`
      UPDATE users 
      SET balance = ${newBalance}, orders = ${JSON.stringify(orders)} 
      WHERE discord_id = ${userId}
    `;

    res.json({
      success: true,
      message: 'Заказ отменен',
      refundAmount,
      newBalance
    });

  } catch (error) {
    console.error('❌ Ошибка отмены заказа:', error);
    res.status(500).json({ success: false, error: 'Внутренняя ошибка' });
  }
});

module.exports = router;