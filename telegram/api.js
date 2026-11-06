"use strict";

const axios = require("axios");

class TelegramAPI {
  constructor(config = {}) {
    this.token = process.env.TELEGRAM_BOT_TOKEN || config.botToken || "";
    this.baseURL = this.token
      ? `https://api.telegram.org/bot${this.token}`
      : "";

    this.client = axios.create({ timeout: 30000 });
  }

  isConfigured() {
    return Boolean(this.token);
  }

  async request(method, data = {}) {
    if (!this.baseURL) {
      throw new Error("TELEGRAM_BOT_TOKEN is missing");
    }

    const response = await this.client.post(
      `${this.baseURL}/${method}`,
      data
    );

    if (!response.data?.ok) {
      throw new Error(
        response.data?.description || `Telegram ${method} failed`
      );
    }

    return response.data.result;
  }

  getMe() {
    return this.request("getMe");
  }

  getUpdates(offset) {
    return this.request("getUpdates", {
      offset,
      timeout: 25,
      allowed_updates: ["message", "callback_query"]
    });
  }

  sendMessage(chatId, text, options = {}) {
    return this.request("sendMessage", {
      chat_id: chatId,
      text: String(text),
      disable_web_page_preview: true,
      ...options
    });
  }

  deleteWebhook() {
    return this.request("deleteWebhook", {
      drop_pending_updates: false
    });
  }
}

module.exports = TelegramAPI;
