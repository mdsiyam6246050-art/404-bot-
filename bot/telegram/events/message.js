"use strict";

module.exports = {
  name: "message",
  version: "1.0.0",
  author: "RJ SIYAM",
  description: "Handle incoming Telegram messages",

  async execute(ctx) {
    const message = ctx.message;

    if (!message || !message.text) return;

    // এখানে সাধারণ Telegram message event-এর কাজ যোগ করবেন।
  }
};
