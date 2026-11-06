"use strict";

class TelegramCommandAdapter {
  constructor() {
    this.commands = new Map([
      ["start", this.start.bind(this)],
      ["help", this.help.bind(this)],
      ["ping", this.ping.bind(this)],
      ["uptime", this.uptime.bind(this)],
      ["status", this.status.bind(this)],
      ["commands", this.commandsList.bind(this)]
    ]);
  }

  async start(ctx) {
    return ctx.reply(
      "🤖 404 Bot Telegram Interface চালু আছে।\n/help লিখে কমান্ড দেখুন।"
    );
  }

  async help(ctx) {
    return ctx.reply(
      "📚 Telegram Commands\n\n" +
      "/start - Bot চালু\n" +
      "/help - সাহায্য\n" +
      "/ping - Response পরীক্ষা\n" +
      "/uptime - চালু থাকার সময়\n" +
      "/status - Bot status\n" +
      "/commands - উপলব্ধ কমান্ড"
    );
  }

  async ping(ctx) {
    return ctx.reply("🏓 Pong!");
  }

  async uptime(ctx) {
    const seconds = Math.floor(process.uptime());
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    return ctx.reply(
      `⏱️ Uptime: ${days} দিন ${hours} ঘণ্টা ${minutes} মিনিট`
    );
  }

  async status(ctx) {
    const bot = global.GoatBot;

    return ctx.reply(
      "📊 404 Bot Status\n\n" +
      `Telegram: Online\n` +
      `Messenger: ${bot?.fcaApi ? "Connected" : "Status unavailable"}\n` +
      `Commands: ${bot?.commands?.size || 0}\n` +
      `Uptime: ${Math.floor(process.uptime())} seconds`
    );
  }

  async commandsList(ctx) {
    const bot = global.GoatBot;
    const commands = bot?.commands;

    if (!commands?.size) {
      return ctx.reply("কমান্ড তালিকা পাওয়া যায়নি।");
    }

    const names = [...commands.values()]
      .map(command => command.config?.name)
      .filter(Boolean)
      .sort();

    return ctx.reply(
      "📚 Messenger command names:\n\n" +
      names.join(", ").slice(0, 3500) +
      "\n\nনোট: Messenger API-নির্ভর কমান্ড Telegram-এ  চালানো যায় না।"
    );
  }

  async execute(ctx) {
    const command = this.commands.get(ctx.command);

    if (!command) {
      return ctx.reply(
        "এই কমান্ডটি পাওয়া যায়নি। /help লিখুন।"
      );
    }

    return command(ctx);
  }
}

module.exports = TelegramCommandAdapter;
