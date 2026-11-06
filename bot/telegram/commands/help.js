"use strict";

module.exports = {
  name: "help",
  version: "1.0.1",
  author: "RJ SIYAM",
  description: "Show all Telegram commands",
  usage: "/help",
  role: 0,
  cooldowns: 3,

  async execute(ctx) {
    const prefix = ctx.config.prefix || "!";

    const isAdmin = ctx.permissions.isAdmin(
      ctx.user.id
    );

    const isOwner = ctx.permissions.isOwner(
      ctx.user.id
    );

    const commands = [...ctx.commands.values()]
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );

    const visibleCommands = commands.filter(command => {
      const role = Number(command.role || 0);

      if (role === 0) return true;
      if (role === 1) return isAdmin;
      if (role === 2) return isOwner;

      return false;
    });

    const list = visibleCommands.map(command => {
      const role = Number(command.role || 0);

      const roleText =
        role === 2 ? "Owner" :
        role === 1 ? "Admin" :
        "Everyone";

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
