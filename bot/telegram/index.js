"use strict";

const fs = require("fs");
const path = require("path");

const TelegramPoller = require("./poller");

const configPath = path.join(__dirname, "../../config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const telegramConfig = config.telegram || {};

if (!telegramConfig.enable) {
  console.log("[Telegram] Disabled.");
  process.exit(0);
}

const token =
  process.env.TELEGRAM_BOT_TOKEN ||
  telegramConfig.botToken;

if (!token) {
  console.error("[Telegram] TELEGRAM_BOT_TOKEN is missing.");
  process.exit(1);
}

const poller = new TelegramPoller(
  telegramConfig,
  config
);

process.once("SIGTERM", () => {
  poller.stop();
  process.exit(0);
});

process.once("SIGINT", () => {
  poller.stop();
  process.exit(0);
});

poller.start().catch(async error => {
  console.error("[Telegram Fatal]", error);

  const { sendTelegramAlert } = require("./notifier");

  await sendTelegramAlert(
    "systemError",
    error.stack || error.message
  );

  process.exit(1);
});
