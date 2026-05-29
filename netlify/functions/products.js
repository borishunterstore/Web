const products = require('../../data/products.json');
// products.js
const products = [
  { "id": "discord_bot_economy", "name": "Экономический бот", "price": 999, "category": "discordbot" },
  { "id": "discord_bot_moderation", "name": "Модераторский бот", "price": 1119, "category": "discordbot" },
  { "id": "video_montaz_easy", "name": "Монтаж для видео Easy", "price": 499, "category": "youtube" }
];

exports.handler = async (event, context) => {
  // Возвращаем успешный ответ с товарами
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*' // Разрешаем запросы с вашего фронтенда
    },
    body: JSON.stringify({ success: true, products: products })
  };
};