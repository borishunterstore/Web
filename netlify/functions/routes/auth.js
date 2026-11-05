const router = require('express').Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { sql } = require('../lib/db');
const { JWT_SECRET, signUserToken, getAuthFromReq } = require('../lib/auth');
const { authLimiter } = require('../lib/rateLimit');

router.post('/auth/discord', authLimiter, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, error: 'No code' });

    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI,
      scope: 'identify email',
    });

    const tokenResp = await axios.post(
      'https://discord.com/api/oauth2/token',
      params,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const userResp = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `${tokenResp.data.token_type} ${tokenResp.data.access_token}` },
    });

    const u = userResp.data;
    const userData = {
      id: u.id,
      username: u.username,
      email: u.email,
      avatar: u.avatar,
      global_name: u.global_name || u.username,
    };

    let isNewUser = false;
    if (sql) {
      const [existing] = await sql`SELECT * FROM users WHERE discord_id = ${u.id}`;
      if (!existing) {
        isNewUser = true;
        await sql`
          INSERT INTO users (discord_id, username, email, avatar, balance, badges)
          VALUES (${u.id}, ${u.username}, ${u.email || ''}, ${u.avatar}, 0, '{}')
        `;
      } else {
        await sql`
          UPDATE users SET username = ${u.username}, email = ${u.email || ''}, avatar = ${u.avatar}, frozen = FALSE
          WHERE discord_id = ${u.id}
        `;
      }
    }

    const token = signUserToken(userData);
    const skipVerification = isNewUser || process.env.SKIP_VERIFICATION === 'true';

    res.json({ success: true, token, user: userData, skipVerification, isNewUser });
  } catch (err) {
    console.error('Discord auth:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Discord auth failed' });
  }
});

router.get('/auth/discord/callback', (req, res) => {
  const { code = '', state = '' } = req.query;
  // Escape для защиты от XSS в inline-скрипте
  const esc = (s) => String(s).replace(/[<>&"']/g, c =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));

  res.type('html').send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Auth</title></head>
<body><p id="status">Processing…</p>
<script>
const code=${JSON.stringify(esc(code))},state=${JSON.stringify(esc(state))};
if(!code){document.body.innerHTML='<p>No code</p>'}
else if(window.opener){
  window.opener.postMessage({type:'DISCORD_AUTH_CALLBACK',code,state},'*');
  document.body.innerHTML='<p>OK, closing…</p>';
  setTimeout(()=>window.close(),500);
}else{document.body.innerHTML='<p>No opener window</p>'}
</script></body></html>`);
});

module.exports = router;