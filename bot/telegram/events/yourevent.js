"use strict";

module.exports = {
  name: "message",
  version: "1.0.0",
  author: "RJ SIYAM",
  description: "Your event description",

  async execute(ctx) {
    const message = ctx.message;

    if (!message) return;

    // Your event code here.
  }
};
