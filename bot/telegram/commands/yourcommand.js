"use strict";

module.exports = {
  name: "yourcommand",
  version: "1.0.0",
  author: "RJ SIYAM",
  description: "Your command description",
  usage: "!yourcommand",
  role: 0,
  cooldowns: 3,

  async execute(ctx) {
    const args = ctx.args;

    return ctx.reply(
      "Command executed successfully!"
    );
  }
};
