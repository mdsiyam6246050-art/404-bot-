"use strict";

const fs = require("fs");
const path = require("path");

const TelegramAPI = require("./api");
const TelegramPermissions = require("./permissions");
const { sendTelegramAlert } = require("./notifier");

class TelegramPoller {
  constructor(config, messengerConfig) {
    this.config = config;
    this.api = new TelegramAPI(
      process.env.TELEGRAM_BOT_TOKEN || config.botToken
    );

    this.permissions = new TelegramPermissions(
      config,
      messengerConfig
    );

    this.commands = new Map();
    this.events = new Map();
    this.offset = undefined;
    this.running = false;
    this.botUsername = "";
  }

  loadFolder(folder, callback) {
    fs.mkdirSync(folder, { recursive: true });

    for (const file of fs.readdirSync(folder)) {
      if (!file.endsWith(".js")) continue;

      const fullPath = path.join(folder, file);

      try {
        delete require.cache[require.resolve(fullPath)];
        const item = require(fullPath);
        callback(item);
        console.log("[Telegram Loader]", file);
      } catch (error) {
        console.error("[Telegram Loader Error]", file, error);

        sendTelegramAlert(
          "systemError",
          `${file}\n${error.stack || error.message}`
        );
      }
    }
  }

  loadHandlers() {
    this.loadFolder(
      path.join(__dirname, "commands"),
      command => {
        if (
          command &&
          command.name &&
          typeof command.execute === "function"
        ) {
          this.commands.set(
            String(command.name).toLowerCase(),
            command
          );
        }
      }
    );

    this.loadFolder(
      path.join(__dirname, "events"),
      event => {
        if (
          event &&
          event.name &&
          typeof event.execute === "function"
        ) {
          this.events.set(event.name, event);
        }
      }
    );

    console.log(
      `[Telegram] Loaded ${this.commands.size} commands and ${this.events.size} events.`
    );
  }

  async handleUpdate(update) {
    if (!this.permissions.isAllowed(update)) return;

    const message = update.message || update.edited_message;
    if (!message) return;

    const ctx = {
      api: this.api,
      config: this.config,
      update,
      message,
      user: message.from,
      chat: message.chat,
      commands: this.commands,
      args: [],

      reply: (text, extra = {}) =>
        this.api.sendMessage(message.chat.id, text, {
          reply_to_message_id: message.message_id,
          ...extra
        })
    };

    const event = this.events.get("message");

    if (event) {
      try {
        await event.execute(ctx);
      } catch (error) {
        console.error("[Telegram Event Error]", error);

        await sendTelegramAlert(
          "eventError",
          error.stack || error.message
        );
      }
    }

    if (!message.text) return;

    const prefix = this.config.prefix || "!";
    let body = message.text.trim();

    if (!body.startsWith(prefix)) return;

    body = body.slice(prefix.length).trim();

    const parts = body.split(/\s+/);
    const commandName = (parts.shift() || "").toLowerCase();

    const command = this.commands.get(commandName);
    if (!command) return;

    ctx.args = parts;

    if (
      command.adminOnly &&
      !this.permissions.isAdmin(message.from.id)
    ) {
      return ctx.reply("⛔ This command is for administrators only.");
    }

    try {
      await command.execute(ctx);
    } catch (error) {
      console.error("[Telegram Command Error]", error);

      await sendTelegramAlert(
        "commandError",
        `Command: ${commandName}\n${error.stack || error.message}`
      );

      await ctx.reply("❌ Command failed. Administrator has been notified.");
    }
  }

  async start() {
    if (this.running) return;

    this.running = true;
    this.loadHandlers();

    await this.api.deleteWebhook();

    const bot = await this.api.getMe();
    this.botUsername = bot.username || "";

    console.log(`[Telegram] Connected as @${this.botUsername}`);

    while (this.running) {
      try {
        const updates = await this.api.getUpdates(this.offset);

        for (const update of updates) {
          this.offset = update.update_id + 1;

          try {
            await this.handleUpdate(update);
          } catch (error) {
            console.error("[Telegram Update Error]", error);
          }
        }
      } catch (error) {
        console.error("[Telegram Polling Error]", error.message);

        await sendTelegramAlert(
          "systemError",
          error.stack || error.message
        );

        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  stop() {
    this.running = false;
  }
}

module.exports = TelegramPoller;
