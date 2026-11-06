"use strict";

const TelegramAPI = require("./api");
const TelegramPermissions = require("./permissions");
const TelegramCommandAdapter = require("./commandAdapter");

class TelegramPoller {
  constructor(config = {}) {
    this.config = config;
    this.api = new TelegramAPI(config);
    this.permissions = new TelegramPermissions(config);
    this.commands = new TelegramCommandAdapter();

    this.offset = 0;
    this.running = false;
    this.stopped = false;
  }

  async handleMessage(message) {
    if (!message?.text) return;

    const permission = this.permissions.check(message);

    if (!permission.allowed) {
      if (permission.reason === "ADMIN_ONLY") {
        await this.api.sendMessage(
          message.chat.id,
          "⛔ এই Bot শুধু অনুমোদিত Admin ব্যবহার করতে পারবেন।"
        );
      }
      return;
    }

    const text = message.text.trim();
    const prefix = this.config.prefix || "!";
    const match = text.match(
      new RegExp("^" + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
      "([a-zA-Z0-9_]+)(?:@\\w+)?(?:\\s+([\\s\\S]*))?$")
    );

    if (!match) return;

    const command = match[1].toLowerCase();

    const ctx = {
      api: this.api,
      message,
      command,
      args: (match[2] || "").trim().split(/\s+/).filter(Boolean),
      userId: permission.userId,
      chatId: permission.chatId,
      isAdmin: permission.isAdmin,
      isOwner: permission.isOwner,

      reply: (replyText, options = {}) =>
        this.api.sendMessage(
          message.chat.id,
          replyText,
          {
            reply_to_message_id: message.message_id,
            ...options
          }
        )
    };

    try {
      await this.commands.execute(ctx);
    } catch (error) {
      console.error("[Telegram command]", error);

      await ctx.reply("❌ কমান্ড চালাতে সমস্যা হয়েছে।");

      try {
        const notifier = require("./notifier");
        const instance = new notifier(this.config);
        await instance.commandError(error.message);
      } catch (_) {}
    }
  }

  async start() {
    if (this.running || this.stopped) return;

    if (!this.api.isConfigured()) {
      console.log("[Telegram] Bot token not configured.");
      return;
    }

    this.running = true;

    try {
      await this.api.deleteWebhook();
      const me = await this.api.getMe();

      console.log(
        `[Telegram] Connected: @${me.username || me.first_name}`
      );

      while (!this.stopped) {
        try {
          const updates = await this.api.getUpdates(this.offset);

          for (const update of updates || []) {
            this.offset = update.update_id + 1;

            if (update.message) {
              await this.handleMessage(update.message);
            }
          }
        } catch (error) {
          console.error("[Telegram polling]", error.message);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    } catch (error) {
      console.error("[Telegram startup]", error.message);
    } finally {
      this.running = false;
    }
  }

  stop() {
    this.stopped = true;
  }
}

module.exports = TelegramPoller;
