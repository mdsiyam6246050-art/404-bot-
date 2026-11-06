"use strict";

module.exports = {
  name: "status",
  version: "1.0.0",
  author: "RJ SIYAM",
  description: "Show Telegram bot status",
  usage: "/status",
  role: 0,
  cooldowns: 5,

  async execute(ctx) {
    const uptime = Math.floor(process.uptime());

    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;

    return ctx.reply(
      "━━━━━━━━━━━━━━━━━━\n" +
      "📊 𝗕𝗢𝗧 𝗦𝗧𝗔𝗧𝗨𝗦\n" +
      "━━━━━━━━━━━━━━━━━━\n\n" +
      "🟢 Status: Online\n" +
      `⏱ Uptime: ${days}d ${hours}h ${minutes}m ${seconds}s\n` +
      `🟢 Node.js: ${process.version}\n` +
      `📦 Commands: ${ctx.commands.size}\n` +
      `👑 Owner: RJ SIYAM\n\n` +
      "━━━━━━━━━━━━━━━━━━"
    );
  }
};
