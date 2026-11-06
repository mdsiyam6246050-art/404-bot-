"use strict";

const TelegramAPI = require("./api");

class TelegramNotifier {
  constructor(config = {}) {
    this.config = config;
    this.api = new TelegramAPI(config);
    this.notifications = config.notifications || {};
  }

  enabled(type) {
    return this.config.enable !== false &&
      this.notifications.enable !== false &&
      this.notifications[type] !== false;
  }

  async send(text, type = "systemError") {
    if (!this.api.isConfigured() || !this.enabled(type)) {
      return false;
    }

    const ids = new Set([
      ...(this.config.adminUID || []).map(String),
      String(this.config.ownerUID || ""),
      ...(this.config.groupIDs || []).map(String)
    ]);

    ids.delete("");
    ids.delete("YOUR_TELEGRAM_USER_ID");
    ids.delete("YOUR_TELEGRAM_GROUP_ID");

    for (const chatId of ids) {
      try {
        await this.api.sendMessage(
          chatId,
          String(text).slice(0, 4000)
        );
      } catch (error) {
        console.error("[Telegram notification]", error.message);
      }
    }

    return true;
  }

  loginError(error) {
    return this.send(
      `❌ Messenger login error\n${error}`,
      "loginError"
    );
  }

  listenerError(error) {
    return this.send(
      `⚠️ Messenger listener error\n${error}`,
      "listenerError"
    );
  }

  commandError(error) {
    return this.send(
      `⚠️ Command error\n${error}`,
      "commandError"
    );
  }

  databaseError(error) {
    return this.send(
      `⚠️ Database error\n${error}`,
      "databaseError"
    );
  }

  restart(reason = "Bot restarted") {
    return this.send(
      `🔄 ${reason}`,
      "restart"
    );
  }
}

module.exports = TelegramNotifier;
