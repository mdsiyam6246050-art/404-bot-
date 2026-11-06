"use strict";

module.exports = {
  name: "ping",
  version: "1.0.0",
  author: "RJ SIYAM",
  description: "Check Telegram bot latency",
  usage: "/ping",
  role: 0,
  cooldowns: 3,

  async execute(ctx) {
    const start = Date.now();

    const sent = await ctx.reply("🏓 Checking response...");

    const latency = Date.now() - start;

    return ctx.reply(
      "━━━━━━━━━━━━━━━━━━\n" +
      "🏓 𝗣𝗢𝗡𝗚\n" +
      "━━━━━━━━━━━━━━━━━━\n\n" +
      `⚡ Response: ${latency}ms\n` +
      `🤖 Bot: @${ctx.botUsername || "TelegramBot"}\n` +
      "🟢 Status: Online\n\n" +
      "Author: RJ SIYAM"
    );
  }
};
