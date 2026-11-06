"use strict";

const axios = require("axios");

class TelegramAPI {
  constructor(config = {}) {
    this.config = config;
    this.token =
      process.env.TELEGRAM_BOT_TOKEN ||
      config.botToken ||
      "";

    this.baseURL = this.token
      ? `https://api.telegram.org/bot${this.token}`
      : null;

    this.client = axios.create({
      timeout: 30000,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  isConfigured() {
    return Boolean(this.token);
  }

  async request(method, data = {}) {
    if (!this.baseURL) {
      throw new Error("Telegram Bot Token is not configured.");
    }

    try {
      const response = await this.client.post(
        `${this.baseURL}/${method}`,
        data
      );

      if (!response.data || !response.data.ok) {
        throw new Error(
          response.data?.description ||
          `Telegram API error: ${method}`
        );
      }

      return response.data.result;
    } catch (error) {
      const description =
        error.response?.data?.description ||
        error.message ||
        "Unknown Telegram API error";

      const apiError = new Error(description);
      apiError.telegramMethod = method;
      apiError.statusCode = error.response?.status;

      throw apiError;
    }
  }

  async getMe() {
    return this.request("getMe");
  }

  async getUpdates(options = {}) {
    return this.request("getUpdates", {
      timeout: 25,
      allowed_updates: [
        "message",
        "edited_message",
        "callback_query"
      ],
      ...options
    });
  }

  async sendMessage(chatId, text, options = {}) {
    if (!chatId) {
      throw new Error("Telegram chat ID is required.");
    }

    return this.request("sendMessage", {
      chat_id: chatId,
      text: String(text ?? ""),
      disable_web_page_preview: true,
      ...options
    });
  }

  async sendPhoto(chatId, photo, options = {}) {
    return this.request("sendPhoto", {
      chat_id: chatId,
      photo,
      ...options
    });
  }

  async sendDocument(chatId, document, options = {}) {
    return this.request("sendDocument", {
      chat_id: chatId,
      document,
      ...options
    });
  }

  async sendLocation(chatId, latitude, longitude, options = {}) {
    return this.request("sendLocation", {
      chat_id: chatId,
      latitude,
      longitude,
      ...options
    });
  }

  async editMessageText(chatId, messageId, text, options = {}) {
    return this.request("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: String(text ?? ""),
      ...options
    });
  }

  async deleteMessage(chatId, messageId) {
    return this.request("deleteMessage", {
      chat_id: chatId,
      message_id: messageId
    });
  }

  async answerCallbackQuery(callbackQueryId, options = {}) {
    return this.request("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      ...options
    });
  }

  async getChat(chatId) {
    return this.request("getChat", {
      chat_id: chatId
    });
  }

  async getChatMember(chatId, userId) {
    return this.request("getChatMember", {
      chat_id: chatId,
      user_id: userId
    });
  }

  async getChatAdministrators(chatId) {
    return this.request("getChatAdministrators", {
      chat_id: chatId
    });
  }

  async setMyCommands(commands, options = {}) {
    return this.request("setMyCommands", {
      commands,
      ...options
    });
  }

  async getWebhookInfo() {
    return this.request("getWebhookInfo");
  }

  async deleteWebhook(options = {}) {
    return this.request("deleteWebhook", options);
  }

  async getFile(fileId) {
    return this.request("getFile", {
      file_id: fileId
    });
  }
}

module.exports = TelegramAPI;
