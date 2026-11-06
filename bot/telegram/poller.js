"use strict";

const fs = require("fs");
const path = require("path");

const TelegramAPI = require("./api");
const TelegramPermissions = require("./permissions");
const { sendTelegramAlert } = require("./notifier");

class TelegramPoller {
  constructor(config, messengerConfig) {
    this.config = config || {};

    this.api = new TelegramAPI(
      process.env.TELEGRAM_BOT_TOKEN ||
      this.config.botToken
    );

    this.permissions = new TelegramPermissions(
      this.config,
      messengerConfig
    );

    this.commands = new Map();
    this.events = new Map();

    this.cooldowns = new Map();

    this.offset = undefined;
    this.running = false;
    this.botUsername = "";
  }

  loadFolder(folder, callback) {
    fs.mkdirSync(folder, { recursive: true });

    const files = fs.readdirSync(folder);

    for (const file of files) {
      if (!file.endsWith(".js")) continue;

      const fullPath = path.join(folder, file);

      try {
        delete require.cache[require.resolve(fullPath)];

        const item = require(fullPath);

        callback(item);

        console.log(
          `[Telegram Loader] Loaded: ${file}`
        );
      } catch (error) {
        console.error(
          `[Telegram Loader Error] ${file}`,
          error
        );

        sendTelegramAlert(
          "systemError",
          `${file}\n${error.stack || error.message}`
        );
      }
    }
  }

  loadHandlers() {
    this.commands.clear();
    this.events.clear();

    this.loadFolder(
      path.join(__dirname, "commands"),
      command => {
        if (
          command &&
          command.name &&
          typeof command.execute === "function"
        ) {
          const name = String(
            command.name
          ).toLowerCase();

          if (this.commands.has(name)) {
            console.warn(
              `[Telegram] Duplicate command: ${name}`
            );
            return;
          }

          this.commands.set(name, command);
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
          this.events.set(
            String(event.name),
            event
          );
        }
      }
    );

    console.log(
      `[Telegram] Loaded ${this.commands.size} commands and ${this.events.size} events.`
    );
  }

  async runEvent(eventName, ctx) {
    const event = this.events.get(eventName);

    if (!event) return;

    try {
      await event.execute(ctx);
    } catch (error) {
      console.error(
        `[Telegram Event: ${eventName}]`,
        error
      );

      await sendTelegramAlert(
        "eventError",
        `${eventName}\n${error.stack || error.message}`
      );
    }
  }

  async handleUpdate(update) {
    const message =
      update.message ||
      update.edited_message;

    const callback = update.callback_query;
    const membership = update.my_chat_member;

    const callbackMessage = callback?.message;

    const chat =
      message?.chat ||
      callbackMessage?.chat ||
      membership?.chat;

    const user =
      message?.from ||
      callback?.from ||
      membership?.from;

    if (!chat) return;

    /*
     * Common Telegram context.
     */
    const ctx = {
      api: this.api,
      config: this.config,
      update,

      message:
        message ||
        callbackMessage ||
        undefined,

      callbackQuery: callback || undefined,

      user: user || undefined,
      chat,

      commands: this.commands,
      events: this.events,
      permissions: this.permissions,

      botUsername: this.botUsername,

      args: [],

      reply: (text, extra = {}) => {
        const replyOptions = {
          ...extra
        };

        if (message?.message_id) {
          replyOptions.reply_to_message_id =
            message.message_id;
        } else if (callbackMessage?.message_id) {
          replyOptions.reply_to_message_id =
            callbackMessage.message_id;
        }

        return this.api.sendMessage(
          chat.id,
          text,
          replyOptions
        );
      },

      answerCallback: (text = "") => {
        if (!callback?.id) return Promise.resolve();

        return this.api.answerCallbackQuery(
          callback.id,
          text
        );
      }
    };

    /*
     * Bot added or removed from a group.
     * This event is not blocked by normal user permissions.
     */
    if (membership) {
      await this.runEvent(
        "my_chat_member",
        ctx
      );

      return;
    }

    /*
     * Check permissions for messages and callbacks.
     */
    if (
      !this.permissions.isAllowed({
        message,
        callback_query: callback
      })
    ) {
      if (callback?.id) {
        await ctx.answerCallback(
          "⛔ You are not allowed to use this bot."
        ).catch(() => {});
      }

      return;
    }

    /*
     * Run message and other event handlers.
     */
    const eventNames = [];

    if (update.message) {
      eventNames.push("message");

      if (
        message.new_chat_members &&
        message.new_chat_members.length
      ) {
        eventNames.push("new_chat_members");
      }
    }

    if (update.edited_message) {
      eventNames.push("edited_message");
    }

    if (callback) {
      eventNames.push("callback_query");
    }

    for (const eventName of eventNames) {
      await this.runEvent(
        eventName,
        ctx
      );
    }

    /*
     * Callback queries are handled by their event.
     */
    if (callback) {
      return;
    }

    /*
     * Only text messages can execute commands.
     */
    if (!message?.text) return;

    const text = message.text.trim();
    const prefix = this.config.prefix || "!";

    let body = "";

    if (text.startsWith(prefix)) {
      body = text.slice(prefix.length).trim();
    } else if (text.startsWith("/")) {
      body = text.slice(1).trim();

      const commandMention = this.botUsername
        ? new RegExp(
            `@${this.botUsername.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            )}\\b`,
            "i"
          )
        : null;

      if (commandMention) {
        body = body.replace(
          commandMention,
          ""
        ).trim();
      }
    } else {
      return;
    }

    const parts = body.split(/\s+/);

    const commandName = (
      parts.shift() || ""
    ).toLowerCase();

    if (!commandName) return;

    const command = this.commands.get(commandName);

    if (!command) return;

    ctx.args = parts;

    /*
     * Role:
     * 0 = Everyone
     * 1 = Admin
     * 2 = Owner
     */
    const role = Number(command.role || 0);

    if (
      role === 1 &&
      !this.permissions.isAdmin(user.id)
    ) {
      return ctx.reply(
        "⛔ This command is only for admins."
      );
    }

    if (
      role === 2 &&
      !this.permissions.isOwner(user.id)
    ) {
      return ctx.reply(
        "⛔ This command is only for the owner."
      );
    }

    /*
     * Per-user command cooldown.
     */
    const cooldown = Math.max(
      0,
      Number(command.cooldowns || 0)
    );

    const cooldownKey =
      `${user.id}:${commandName}`;

    const now = Date.now();

    const expiresAt =
      this.cooldowns.get(cooldownKey) || 0;

    if (expiresAt > now) {
      const remaining = Math.ceil(
        (expiresAt - now) / 1000
      );

      return ctx.reply(
        `⏳ Please wait ${remaining}s before using this command again.`
      );
    }

    if (cooldown > 0) {
      this.cooldowns.set(
        cooldownKey,
        now + cooldown * 1000
      );
    }

    try {
      await command.execute(ctx);
    } catch (error) {
      console.error(
        `[Telegram Command: ${commandName}]`,
        error
      );

      this.cooldowns.delete(cooldownKey);

      await sendTelegramAlert(
        "commandError",
        `Command: ${commandName}\n${error.stack || error.message}`
      );

      await ctx.reply(
        "❌ Command failed. Administrator has been notified."
      ).catch(() => {});
    }
  }

  async start() {
    if (this.running) return;

    this.running = true;

    this.loadHandlers();

    await this.api.deleteWebhook();

    const bot = await this.api.getMe();

    this.botUsername = bot.username || "";

    console.log(
      `[Telegram] Connected as @${this.botUsername}`
    );

    await sendTelegramAlert(
      "startup",
      `Telegram connected as @${this.botUsername}`
    );

    while (this.running) {
      try {
        const updates = await this.api.getUpdates(
          this.offset
        );

        for (const update of updates) {
          this.offset = update.update_id + 1;

          try {
            await this.handleUpdate(update);
          } catch (error) {
            console.error(
              "[Telegram Update Error]",
              error
            );

            await sendTelegramAlert(
              "systemError",
              error.stack || error.message
            );
          }
        }
      } catch (error) {
        if (!this.running) break;

        console.error(
          "[Telegram Polling Error]",
          error.message
        );

        await sendTelegramAlert(
          "systemError",
          error.stack || error.message
        );

        await new Promise(resolve => {
          setTimeout(resolve, 5000);
        });
      }
    }
  }

  stop() {
    this.running = false;

    console.log("[Telegram] Poller stopped.");
  }
}

module.exports = TelegramPoller;
