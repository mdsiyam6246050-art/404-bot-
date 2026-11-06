"use strict";

class TelegramPermissions {
  constructor(config = {}) {
    this.config = config;
    this.security = config.security || {};
  }

  ownerId() {
    return String(this.config.ownerUID || "");
  }

  adminIds() {
    return (this.config.adminUID || []).map(String);
  }

  isOwner(userId) {
    return String(userId) === this.ownerId() &&
      Boolean(this.ownerId());
  }

  isAdmin(userId) {
    const id = String(userId);

    return this.isOwner(id) ||
      this.adminIds().includes(id);
  }

  isAllowedChat(message) {
    const chat = message.chat || {};
    const chatId = String(chat.id);

    if (chat.type === "private") {
      return this.config.allowPrivate !== false;
    }

    if (["group", "supergroup"].includes(chat.type)) {
      if (this.config.allowGroup === false) return false;

      const groups = (this.config.groupIDs || []).map(String);

      if (groups.length && !groups.includes(chatId)) {
        return this.security.allowUnknownGroups === true;
      }

      return true;
    }

    return false;
  }

  check(message) {
    const userId = String(message.from?.id || "");

    if (!userId) {
      return { allowed: false, reason: "USER_NOT_FOUND" };
    }

    if (!this.isAllowedChat(message)) {
      return { allowed: false, reason: "CHAT_NOT_ALLOWED" };
    }

    if (
      this.security.adminOnly !== false &&
      !this.isAdmin(userId)
    ) {
      return { allowed: false, reason: "ADMIN_ONLY" };
    }

    return {
      allowed: true,
      userId,
      chatId: String(message.chat.id),
      isOwner: this.isOwner(userId),
      isAdmin: this.isAdmin(userId)
    };
  }
}

module.exports = TelegramPermissions;
