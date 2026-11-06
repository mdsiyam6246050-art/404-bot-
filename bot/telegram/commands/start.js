"use strict";

module.exports = {
  name: "start",
  version: "1.0.0",
  author: "RJ SIYAM",
  description: "Start Telegram bot",
  usage: "/start",
  role: 0,
  cooldowns: 3,

  async execute(ctx) {
    return ctx.reply(
      "━━━━━━━━━━━━━━━━━━\n" +
      "🤖 𝗥𝗝 𝗦𝗜𝗬𝗔𝗠 𝗕𝗢𝗧\n" +
      "━━━━━━━━━━━━━━━━━━\n\n" +
      "✅ Telegram bot is online!\n" +
      "📚 Use /help to see commands.\n\n" +
      "⚡ Author: RJ SIYAM"
    );
  }
};
