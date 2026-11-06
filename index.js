"use strict";

const http = require("http");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;

const config = JSON.parse(
  fs.readFileSync(path.join(ROOT, "config.json"), "utf8")
);

const { sendTelegramAlert } = require("./bot/telegram/notifier");

let guardianProcess = null;
let telegramProcess = null;
let shuttingDown = false;
let guardianRestartTimer = null;
let telegramRestartTimer = null;

const startedAt = Date.now();

function startTelegram() {
  if (shuttingDown || telegramProcess) return;

  const tg = config.telegram || {};
  const token = process.env.TELEGRAM_BOT_TOKEN || tg.botToken;

  if (!tg.enable || !token) {
    console.log("[Telegram] Disabled or token missing.");
    return;
  }

  telegramProcess = spawn(
    process.execPath,
    [path.join(ROOT, "bot/telegram/index.js")],
    {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  telegramProcess.stdout.on("data", data => {
    process.stdout.write(data);
  });

  telegramProcess.stderr.on("data", data => {
    process.stderr.write(data);
  });

  telegramProcess.on("error", error => {
    console.error("[Telegram process]", error);
    sendTelegramAlert("systemError", error.stack || error.message);
  });

  telegramProcess.on("close", (code, signal) => {
    telegramProcess = null;

    if (shuttingDown) return;

    sendTelegramAlert(
      "restart",
      `Telegram process stopped.\nCode: ${code}\nSignal: ${signal || "none"}`
    );

    telegramRestartTimer = setTimeout(startTelegram, 5000);
  });
}

function startGuardian() {
  if (shuttingDown || guardianProcess) return;

  console.log("[404 BOT] Starting Messenger Guardian...");

  guardianProcess = spawn(
    process.execPath,
    [path.join(ROOT, "guardian/start.js")],
    {
      cwd: ROOT,
      env: process.env,
      stdio: ["inherit", "pipe", "pipe"]
    }
  );

  guardianProcess.stdout.on("data", data => {
    process.stdout.write(data);
  });

  guardianProcess.stderr.on("data", data => {
    process.stderr.write(data);
  });

  guardianProcess.on("error", error => {
    console.error("[Guardian]", error);
    sendTelegramAlert("guardianError", error.stack || error.message);
  });

  guardianProcess.on("close", (code, signal) => {
    guardianProcess = null;

    if (shuttingDown) return;

    sendTelegramAlert(
      "guardianError",
      `Messenger Guardian stopped.\nCode: ${code}\nSignal: ${signal || "none"}`
    );

    guardianRestartTimer = setTimeout(startGuardian, 5000);
  });
}

const server = http.createServer((req, res) => {
  const pathname = new URL(
    req.url,
    `http://${req.headers.host || "localhost"}`
  ).pathname;

  if (pathname === "/" || pathname === "/health") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    });

    return res.end(JSON.stringify({
      service: "404-BOT",
      messenger: Boolean(guardianProcess),
      telegram: Boolean(telegramProcess),
      uptime: Math.floor(process.uptime()),
      startedAt: new Date(startedAt).toISOString()
    }));
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[404 BOT] HTTP server running on ${PORT}`);

  startTelegram();
  startGuardian();

  sendTelegramAlert(
    "startup",
    "Messenger + Telegram services are starting."
  );
});

function shutdown(signal) {
  if (shuttingDown) return;

  shuttingDown = true;
  console.log(`[404 BOT] ${signal} received.`);

  clearTimeout(guardianRestartTimer);
  clearTimeout(telegramRestartTimer);

  sendTelegramAlert("shutdown", `Main process received ${signal}.`);

  if (guardianProcess) guardianProcess.kill("SIGTERM");
  if (telegramProcess) telegramProcess.kill("SIGTERM");

  server.close(() => process.exit(0));

  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", error => {
  console.error("[Uncaught Exception]", error);
  sendTelegramAlert("systemError", error.stack || error.message);
  shutdown("uncaughtException");
});

process.on("unhandledRejection", reason => {
  console.error("[Unhandled Rejection]", reason);
  sendTelegramAlert(
    "systemError",
    reason?.stack || String(reason)
  );
});
