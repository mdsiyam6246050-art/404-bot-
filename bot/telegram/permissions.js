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

  isOwner(telegramID) {
    return (
      String(this.tg.ownerUID || "") ===
      String(telegramID)
    );
  }

  isAdmin(telegramID) {
    const id = String(telegramID);

    const telegramAdmins = (
      this.tg.adminUID || []
    ).map(String);

    if (
      telegramAdmins.includes(id) ||
      this.isOwner(id)
    ) {
      return true;
    }

    if (this.tg.useMessengerAdmin) {
      const messengerID = this.mappedMessengerID(id);

      if (!messengerID) return false;

      const messengerAdmins = (
        this.ms.adminBot || []
      ).map(String);

      const messengerOwner = String(
        this.ms.security?.ownerUID || ""
      );

      return (
        messengerAdmins.includes(messengerID) ||
        messengerOwner === messengerID
      );
    }

    return false;
  }

  isAllowed(update = {}) {
    const message =
      update.message ||
      update.edited_message ||
      update.callback_query?.message;

    const user =
      update.callback_query?.from ||
      message?.from;

    if (!message?.chat || !user?.id) {
      return false;
    }

    const userID = String(user.id);
    const chatID = String(message.chat.id);
    const chatType = message.chat.type;

    if (this.isBlocked(userID)) {
      return false;
    }

    if (chatType === "private") {
      if (this.tg.allowPrivate === false) {
        return false;
      }
    } else if (
      chatType === "group" ||
      chatType === "supergroup"
    ) {
      if (this.tg.allowGroup === false) {
        return false;
      }

      const allowedGroups = (
        this.tg.groupIDs || []
      ).map(String);

      const allowAllGroups =
        this.tg.allowAllGroups === true ||
        this.tg.security?.allowUnknownGroups === true;

      if (
        !allowAllGroups &&
        !allowedGroups.includes(chatID)
      ) {
        return false;
      }
    } else {
      return false;
    }

    if (this.tg.useMessengerWhitelist) {
      const messengerID = this.mappedMessengerID(userID);

      const whitelist = (
        this.ms.whiteListMode?.whiteListIds || []
      ).map(String);

      if (
        !messengerID ||
        !whitelist.includes(messengerID)
      ) {
        return false;
      }
    }

    const adminOnly =
      this.tg.adminOnly === true ||
      this.tg.security?.adminOnly === true;

    if (adminOnly && !this.isAdmin(userID)) {
      return false;
    }

    return true;
  }
}

module.exports = TelegramPermissions;
