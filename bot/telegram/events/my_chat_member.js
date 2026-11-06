"use strict";

module.exports = {
  name: "my_chat_member",
  version: "1.0.0",
  author: "RJ SIYAM",
  description: "Detect bot added or removed from a chat",

  async execute(ctx) {
    const update = ctx.update;
    const change = update.my_chat_member;

    if (!change) return;

    const oldStatus = change.old_chat_member?.status;
    const newStatus = change.new_chat_member?.status;

    if (
      newStatus === "member" ||
      newStatus === "administrator"
    ) {
      return ctx.api.sendMessage(
        change.chat.id,
        "✅ 𝗥𝗝 𝗦𝗜𝗬𝗔𝗠 𝗕𝗢𝗧 𝗔𝗖𝗧𝗜𝗩𝗘\n\n" +
        "Thanks for adding me!\n" +
        "Use /help to see my commands."
      );
    }

    if (
      oldStatus !== "left" &&
      (newStatus === "left" || newStatus === "kicked")
    ) {
      console.log(
        `[Telegram] Bot removed from chat ${change.chat.id}`
      );
    }
  }
};
