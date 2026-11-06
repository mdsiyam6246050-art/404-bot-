"use strict";

const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "../../config.json");

let config = {};

try {
  config = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch (error) {
  console.error("[Telegram] config.json error:", error.message);
  process.exit(1);
}

const telegramConfig = config.telegram || {};

if (telegramConfig.enable === false) {
  console.log("[Telegram] Disabled in config.json");
  process.exit(0);
}

const TelegramPoller = require("./poller");
const poller = new TelegramPoller(telegramConfig);

process.on("SIGTERM", () => {
  poller.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  poller.stop();
  process.exit(0);
});

poller.start().catch(error => {
  console.error("[Telegram] Fatal error:", error);
});
