const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('❌ КРИТИЧНО: JWT_SECRET не задан или слишком короткий (мин. 32 символа)!');
}

const ADMIN_ID = process.env.ADMIN_ID || '992442453833547886';

function decodeAuthToken(token) {
  if (!token || !JWT_SECRET) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function getAuthFromReq(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  return decodeAuthToken(h.slice(7));
}

async function isAdminUserAsync(decoded) {
  if (!decoded) return false;
  if (decoded.id === ADMIN_ID) return true;
  
  const { sql } = require('./db');
  if (!sql) return false;
  
  try {
    const [u] = await sql`SELECT badges FROM users WHERE discord_id = ${decoded.id}`;
    return u?.badges?.admin === true;
  } catch {
    return false;
  }
}

function signUserToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email, avatar: user.avatar },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = { 
  decodeAuthToken, 
  getAuthFromReq, 
  isAdminUserAsync, 
  signUserToken, 
  JWT_SECRET, 
  ADMIN_ID 
};