"use strict";

module.exports = {
  name: "new_chat_members",
  version: "1.0.0",
  author: "RJ SIYAM",
  description: "Welcome new Telegram group members",

  async execute(ctx) {
    const message = ctx.message;
    if (!message?.new_chat_members?.length) return;

    const names = message.new_chat_members
      .map(member => {
        const name = [
          member.first_name,
          member.last_name
        ].filter(Boolean).join(" ");

        return name || "New member";
      })
      .join(", ");

    return ctx.reply(
      "━━━━━━━━━━━━━━━━━━\n" +
      "👋 𝗪𝗘𝗟𝗖𝗢𝗠𝗘\n" +
      "━━━━━━━━━━━━━━━━━━\n\n" +
      `Welcome ${names}!\n` +
      "Enjoy your stay in the group.\n\n" +
      "⚡ RJ SIYAM"
    );
  }
};
