// В serverless setInterval не работает между вызовами.
// Простой sliding-window на Map, но без定时 очистки.
const buckets = new Map();

function rateLimit({ windowMs, max, message }) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };

    if (bucket.resetAt < now) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }
    bucket.count++;
    buckets.set(key, bucket);

    // Ленивая очистка: 1% шанс
    if (Math.random() < 0.01) {
      for (const [k, v] of buckets) {
        if (v.resetAt < now) buckets.delete(k);
      }
    }

    if (bucket.count > max) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      return res.status(429).json({ success: false, error: message });
    }
    next();
  };
}

module.exports = {
  rateLimit,
  authLimiter: rateLimit({ windowMs: 15 * 60_000, max: 30, message: 'Слишком много попыток' }),
  chatLimiter: rateLimit({ windowMs: 60_000, max: 20, message: 'Слишком много сообщений' }),
  orderLimiter: rateLimit({ windowMs: 60_000, max: 10, message: 'Слишком много заказов' }),
  telegramLimiter: rateLimit({ windowMs: 15 * 60_000, max: 5, message: 'Подождите 15 минут' }),
};