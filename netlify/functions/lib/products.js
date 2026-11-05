// Базовый список товаров (фолбэк, если БД пуста)
const getTestProducts = () => {
    return [
      {
        id: "discord_bot_economy",
        name: "Экономический бот",
        description: "Экономический бот, который поможет вам умело управлять экономикой!",
        price: 999,
        category: "discordbot",
        icon: "image/emoji/shop_discord.png",
        features: ["ЯП: Python", "База данных - JSON или DATABASE", "Гарантия 2 недели"]
      },
      {
        id: "discord_bot_moderation",
        name: "Модераторский бот",
        description: "Модераторский бот с основными командами!",
        price: 1119,
        category: "discordbot",
        icon: "image/emoji/shop_discord.png",
        features: ["ЯП: Python", "Система варнов и банов", "Гарантия 2 недели"]
      },
      {
        id: "video_montaz_easy",
        name: "Монтаж (Easy)",
        description: "Базовый монтаж для видео",
        price: 499,
        category: "youtube",
        icon: "image/emoji/montaz.png",
        features: ["Ролик до 3 мин.", "Переходы", "Соединение клипов"]
      }
    ];
  };
  
  module.exports = { getTestProducts };