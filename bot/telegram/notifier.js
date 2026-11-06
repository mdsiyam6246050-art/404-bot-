"use strict";

const fs = require("fs");
const path = require("path");
const TelegramAPI = require("./api");

const CONFIG_PATH = path.join(__dirname, "../../config.json");

function getConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

function formatAlert(type, details) {
  const titles = {
    startup: "🚀 BOT STARTING",
    shutdown: "🛑 BOT SHUTDOWN",
    loginError: "🔐 MESSENGER LOGIN ERROR",
    logout: "🚪 MESSENGER LOGOUT",
    cookieError: "🍪 COOKIE ERROR",
    listenerError: "📡 MQTT LISTENER ERROR",
    commandError: "⚠️ COMMAND ERROR",
    eventError: "⚠️ EVENT ERROR",
    databaseError: "🗄 DATABASE ERROR",
    systemError: "🚨 SYSTEM ERROR",
    guardianError: "🛡 GUARDIAN ERROR",
    restart: "🔄 BOT RESTART"
  };

  return [
    "━━━━━━━━━━━━━━━━━━",
    titles[type] || "🚨 BOT NOTIFICATION",
    "━━━━━━━━━━━━━━━━━━",
    `Project: **siyam BOT**`,
    `Owner: **RJ SIYAM**`,
    `Type: ${type}`,
    "",
    String(details || "No details available").slice(0, 3000),
    "",
    `Time: ${new Date().toLocaleString("en-GB", {
      timeZone: "Asia/Dhaka"
    })}`,
    "━━━━━━━━━━━━━━━━━━"
  ].join("\n");
}

async function sendTelegramAlert(type, details) {
  try {
    const config = getConfig();
    const tg = config.telegram || {};
    const notices = tg.notifications || {};

    if (!tg.enable || notices.enable === false) return;
    if (notices[type] === false) return;

    const token = process.env.TELEGRAM_BOT_TOKEN || tg.botToken;
    if (!token) return;

    const api = new TelegramAPI(token);

    const recipients = new Set([
      ...(tg.adminUID || []).map(String),
      String(tg.ownerUID || ""),
      ...(tg.groupIDs || []).map(String)
    ]);

    const message = formatAlert(type, details);

    for (const id of recipients) {
      if (!id) continue;

      try {
        await api.sendMessage(id, message);
      } catch (error) {
        console.error(
          "[Telegram Alert Failed]",
          id,
          error.response?.data || error.message
        );
      }
    }
  } catch (error) {
    console.error("[Notifier Error]", error.message);
  }
}

module.exports = { sendTelegramAlert };
