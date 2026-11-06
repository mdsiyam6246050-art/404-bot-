"use strict";

class TelegramPermissions {
  constructor(config, messengerConfig) {
    this.tg = config || {};
    this.ms = messengerConfig || {};
  }

  // Telegram Owner check
  isOwner(telegramID) {
    const id = String(telegramID || "");
    const ownerID = String(this.tg.ownerUID || "");

    return Boolean(id && ownerID && id === ownerID);
  }

  // Telegram Admin check
  isAdmin(telegramID) {
    const id = String(telegramID || "");

    if (!id) return false;

    if (this.isOwner(id)) return true;

    const admins = Array.isArray(this.tg.adminUID)
      ? this.tg.adminUID.map(String)
      : [];

    return admins.includes(id);
  }

  // Telegram blacklist check
  isBlocked(telegramID) {
    const id = String(telegramID || "");

    const blacklist = Array.isArray(this.tg.blacklistUIDs)
      ? this.tg.blacklistUIDs.map(String)
      : [];

    return blacklist.includes(id);
  }

  // Telegram whitelist check
  isWhitelisted(telegramID) {
    const id = String(telegramID || "");

    if (!id) return false;

    // Admin and Owner always have access
    if (this.isAdmin(id)) return true;

    if (this.tg.useWhitelist !== true) return true;

    const whitelist = Array.isArray(this.tg.whitelistUIDs)
      ? this.tg.whitelistUIDs.map(String)
      : [];

    return whitelist.includes(id);
  }

  // Check whether a Telegram user can use the bot
  isAllowed(update = {}) {
    const message =
      update.message ||
      update.edited_message ||
      update.callback_query?.message;

    const user =
      update.callback_query?.from ||
      message?.from;

    if (!message?.chat || !user?.id) return false;

    const userID = String(user.id);
    const chatID = String(message.chat.id);
    const chatType = message.chat.type;

    // Block blacklisted users
    if (this.isBlocked(userID)) return false;

    // Private chat permission
    if (chatType === "private") {
      if (this.tg.allowPrivate === false) return false;
    }

    // Group and supergroup permission
    else if (chatType === "group" || chatType === "supergroup") {
      if (this.tg.allowGroup === false) return false;

      const allowAllGroups =
        this.tg.allowAllGroups === true ||
        this.tg.security?.allowUnknownGroups === true;

      if (!allowAllGroups) {
        const allowedGroups = Array.isArray(this.tg.groupIDs)
          ? this.tg.groupIDs.map(String)
          : [];

        if (!allowedGroups.includes(chatID)) return false;
      }
    }

    // Reject unsupported chat types
    else {
      return false;
    }

    // Whitelist permission
    if (!this.isWhitelisted(userID)) return false;

    // Admin-only mode
    const adminOnly =
      this.tg.adminOnly === true ||
      this.tg.security?.adminOnly === true;

    if (adminOnly && !this.isAdmin(userID)) return false;

    return true;
  }
}

module.exports = TelegramPermissions;
