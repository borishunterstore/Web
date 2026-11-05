const { neon } = require('@neondatabase/serverless');

let sql = null;
if (process.env.DATABASE_URL) {
  sql = neon(process.env.DATABASE_URL);
}

async function initDatabase() {
  if (!sql) return;
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
  await sql`CREATE INDEX IF NOT EXISTS idx_users_registered ON users(registered_at DESC)`;

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
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id, timestamp DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(user_id) WHERE read = FALSE AND from_admin = FALSE`;

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

  await sql`
    CREATE TABLE IF NOT EXISTS verification_codes (
      user_id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      attempts INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

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

  await sql`
    CREATE TABLE IF NOT EXISTS shop_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value BOOLEAN DEFAULT TRUE,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT
    )
  `;

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
  await sql`CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, created_at DESC)`;
}

async function initShopSettings() {
  if (!sql) return;
  const defaults = [
    ['shop_open', true],
    ['auth_enabled', true],
    ['registration_enabled', true],
    ['site_access', true],
  ];
  for (const [k, v] of defaults) {
    await sql`
      INSERT INTO shop_settings (setting_key, setting_value)
      VALUES (${k}, ${v})
      ON CONFLICT (setting_key) DO NOTHING
    `;
  }
}

module.exports = { sql, initDatabase, initShopSettings };