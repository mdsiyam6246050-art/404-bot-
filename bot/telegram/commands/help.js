"use strict";

module.exports = {
  name: "help",
  version: "1.0.0",
  author: "RJ SIYAM",
  description: "Show all Telegram commands",
  usage: "/help",
  role: 0,
  cooldowns: 3,

  async execute(ctx) {
    const prefix = ctx.config.prefix || "!";

    const commands = [...ctx.commands.values()]
      .sort((a, b) => a.name.localeCompare(b.name));

    const publicCommands = commands.filter(command => {
      return Number(command.role || 0) === 0 ||
        ctx.permissions.isAdmin(ctx.user.id);
    });

    const list = publicCommands.map(command => {
      const role = Number(command.role || 0);
      const roleText =
        role === 2 ? "Owner" :
        role === 1 ? "Admin" : "Everyone";

      return (
        `${prefix}${command.name}\n` +
        `├ Description: ${command.description || "N/A"}\n` +
        `├ Usage: ${command.usage || prefix + command.name}\n` +
        `└ Role: ${roleText}`
      );
    }).join("\n\n");

    return ctx.reply(
      "━━━━━━━━━━━━━━━━━━\n" +
      "📚 𝗧𝗘𝗟𝗘𝗚𝗥𝗔𝗠 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦\n" +
      "━━━━━━━━━━━━━━━━━━\n\n" +
      (list || "No commands available.") +
      "\n\n━━━━━━━━━━━━━━━━━━\n" +
      `Prefix: ${prefix}\n` +
      "Author: RJ SIYAM"
    );
  }
};
