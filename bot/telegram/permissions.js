"use strict";

class TelegramPermissions {
  constructor(config, messengerConfig) {
    this.tg = config || {};
    this.ms = messengerConfig || {};
  }

  mappedMessengerID(telegramID) {
    return String(
      this.tg.identityMap?.[String(telegramID)] || ""
    );
  }

  isBlocked(telegramID) {
    return (this.tg.blacklistUIDs || [])
      .map(String)
      .includes(String(telegramID));
  }

  isAdmin(telegramID) {
    const id = String(telegramID);

    if ((this.tg.adminUID || []).map(String).includes(id)) {
      return true;
    }

    if (String(this.tg.ownerUID || "") === id) {
      return true;
    }

    if (this.tg.useMessengerAdmin) {
      const messengerID = this.mappedMessengerID(id);

      if (messengerID) {
        const admins = (this.ms.adminBot || []).map(String);
        const owner = String(this.ms.security?.ownerUID || "");

        return admins.includes(messengerID) ||
          owner === messengerID;
      }
    }

    return false;
  }

  isAllowed(update) {
    const message = update.message || update.edited_message;
    if (!message?.from || !message.chat) return false;

    const userID = String(message.from.id);
    const chatType = message.chat.type;

    if (this.isBlocked(userID)) return false;

    if (chatType === "private") {
      if (this.tg.allowPrivate === false) return false;
    } else if (chatType === "group" || chatType === "supergroup") {
      if (this.tg.allowGroup === false) return false;

      if (this.tg.allowAllGroups !== true) {
        const allowed = (this.tg.groupIDs || []).map(String);
        if (!allowed.includes(String(message.chat.id))) return false;
      }
    } else {
      return false;
    }

    if (this.tg.useMessengerWhitelist) {
      const messengerID = this.mappedMessengerID(userID);
      const whitelist = (
        this.ms.whiteListMode?.whiteListIds || []
      ).map(String);

      if (!messengerID || !whitelist.includes(messengerID)) {
        return false;
      }
    }

    if (this.tg.adminOnly && !this.isAdmin(userID)) {
      return false;
    }

    return true;
  }
}

module.exports = TelegramPermissions;
