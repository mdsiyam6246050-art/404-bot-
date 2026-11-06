"use strict";

const axios = require("axios");

class TelegramAPI {
  constructor(token) {
    if (!token) {
      throw new Error("Telegram bot token missing.");
    }

    this.url = `https://api.telegram.org/bot${token}`;
  }

  async request(method, data = {}) {
    const response = await axios.post(
      `${this.url}/${method}`,
      data,
      { timeout: 40000 }
    );

    if (!response.data.ok) {
      throw new Error(
        response.data.description ||
        "Telegram API request failed."
      );
    }

    return response.data.result;
  }

  getMe() {
    return this.request("getMe");
  }

  getUpdates(offset) {
    return this.request("getUpdates", {
      ...(offset === undefined ? {} : { offset }),
      timeout: 30,
      allowed_updates: [
        "message",
        "edited_message",
        "callback_query",
        "my_chat_member"
      ]
    });
  }

  sendMessage(chatId, text, extra = {}) {
    return this.request("sendMessage", {
      chat_id: chatId,
      text: String(text).slice(0, 4000),
      ...extra
    });
  }

  answerCallbackQuery(callbackQueryId, text = "") {
    return this.request("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      ...(text ? { text: String(text).slice(0, 200) } : {})
    });
  }

  deleteWebhook() {
    return this.request("deleteWebhook", {
      drop_pending_updates: false
    });
  }
}

module.exports = TelegramAPI;
