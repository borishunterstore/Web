const { neon } = require('@neondatabase/serverless');

let sql = null;
if (process.env.DATABASE_URL) {
  sql = neon(process.env.DATABASE_URL);
}

async function initDatabase() {
  if (!sql) return;
  
  try {
    // Пользователи
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        discord_id TEXT PRIMARY KEY,
        username TEXT,
        email TEXT,
        avatar TEXT,
        password TEXT,
        balance INTEGER DEFAULT 0,
        badges JSONB DEFAULT '{}',
        orders JSONB DEFAULT '[]',
        used_promocodes JSONB DEFAULT '[]',
        active_promocodes JSONB DEFAULT '[]',
        privacy JSONB DEFAULT '{"show_avatar":true,"show_orders":true,"show_badges":true,"show_spent":true,"show_orders_count":true,"show_registered":true,"hide_profile":false}',
        frozen BOOLEAN DEFAULT FALSE,
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Добавляем колонки, если их нет (для старых БД)
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy JSONB DEFAULT '{"show_avatar":true,"show_orders":true,"show_badges":true,"show_spent":true,"show_orders_count":true,"show_registered":true,"hide_profile":false}'`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS frozen BOOLEAN DEFAULT FALSE`;

    // Сообщения (чат)
    await sql`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(discord_id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        from_admin BOOLEAN DEFAULT FALSE,
        read BOOLEAN DEFAULT FALSE,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Промокоды
    await sql`
      CREATE TABLE IF NOT EXISTS promocodes (
        code TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        value INTEGER NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        max_uses INTEGER DEFAULT 0,
        used_count INTEGER DEFAULT 0,
        used_by JSONB DEFAULT '[]',
        valid_from TIMESTAMP,
        valid_until TIMESTAMP,
        valid_days INTEGER DEFAULT 0,
        max_uses_per_user INTEGER DEFAULT 1,
        product_ids JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Коды верификации
    await sql`
      CREATE TABLE IF NOT EXISTS verification_codes (
        user_id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        attempts INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Сессии (Telegram)
    await sql`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT,
        username TEXT,
        name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      )
    `;

    // Настройки магазина
    await sql`
      CREATE TABLE IF NOT EXISTS shop_settings (
        setting_key TEXT PRIMARY KEY,
        setting_value BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by TEXT
      )
    `;

    // Новости
    await sql`
      CREATE TABLE IF NOT EXISTS news (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        date DATE DEFAULT CURRENT_DATE,
        category TEXT DEFAULT 'announcement',
        views INTEGER DEFAULT 0,
        author TEXT DEFAULT 'BS',
        tags JSONB DEFAULT '[]',
        image TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Транзакции (история баланса)
    await sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(discord_id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        type TEXT CHECK (type IN ('deposit','withdrawal','purchase')),
        reason TEXT,
        admin_id TEXT,
        admin_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Отзывы
    await sql`
      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(discord_id) ON DELETE CASCADE,
        name TEXT,
        avatar TEXT,
        product_id TEXT,
        product_name TEXT,
        rating INTEGER,
        text TEXT,
        images JSONB DEFAULT '[]',
        verified_purchase BOOLEAN DEFAULT FALSE,
        verified BOOLEAN DEFAULT FALSE,
        helpful INTEGER DEFAULT 0,
        admin_reply JSONB,
        created_at TIMESTAMP,
        updated_at TIMESTAMP
      )
    `;

    // Товары (если добавляются через админку)
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price INTEGER NOT NULL,
        category TEXT,
        icon TEXT,
        image TEXT,
        features JSONB DEFAULT '[]',
        popular BOOLEAN DEFAULT FALSE,
        discount INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('✅ База данных инициализирована');
  } catch (error) {
    console.error('❌ Ошибка инициализации БД:', error.message);
  }
}

async function initShopSettings() {
  if (!sql) return;
  const defaults = [
    ['shop_open', true],
    ['auth_enabled', true],
    ['registration_enabled', true],
    ['site_access', true],
  ];
  try {
    for (const [k, v] of defaults) {
      await sql`
        INSERT INTO shop_settings (setting_key, setting_value)
        VALUES (${k}, ${v})
        ON CONFLICT (setting_key) DO NOTHING
      `;
    }
    console.log('✅ Настройки магазина инициализированы');
  } catch (e) {
    console.error('❌ Ошибка настроек:', e.message);
  }
}

module.exports = { sql, initDatabase, initShopSettings };