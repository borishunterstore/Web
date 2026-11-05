// lib/webhooks.js
const axios = require('axios');

const W = {
  chat: process.env.DISCORD_WEBHOOK_CHAT,
  verify: process.env.DISCORD_WEBHOOK_VERIFY,
  purchase: process.env.DISCORD_WEBHOOK_PURCHASE,
  review: process.env.DISCORD_WEBHOOK_REVIEW,
  welcome: process.env.DISCORD_WEBHOOK_WELCOME,
  news: process.env.DISCORD_WEBHOOK_NEWS,
  admin: process.env.DISCORD_WEBHOOK_ADMIN,
};

async function send(type, payload) {
  const url = W[type];
  if (!url) return null;
  try {
    return await axios.post(url, payload, { timeout: 5000 });
  } catch (e) {
    console.error(`Webhook ${type} failed:`, e.message);
    return null;
  }
}

module.exports = { send };