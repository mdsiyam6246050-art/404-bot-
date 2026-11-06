"use strict";

const http = require("http");
const { spawn } = require("child_process");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

let guardianProcess = null;
let telegramProcess = null;
let shuttingDown = false;
let restartTimer = null;

const startedAt = Date.now();

function startTelegram() {
  if (shuttingDown || telegramProcess) return;

  telegramProcess = spawn(
    process.execPath,
    [path.join(__dirname, "bot/telegram/index.js")],
    {
      cwd: __dirname,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
    }
  );

  telegramProcess.stdout.on("data", data => {
    process.stdout.write(data);
  });

  telegramProcess.stderr.on("data", data => {
    process.stderr.write(data);
  });

  telegramProcess.on("close", () => {
    telegramProcess = null;

    if (!shuttingDown) {
      setTimeout(startTelegram, 5000);
    }
  });

  telegramProcess.on("error", error => {
    console.error("[Telegram process]", error.message);
  });
}

function startGuardian() {
  if (shuttingDown) return;

  console.log("[404 BOT] Starting Facebook Guardian...");

  guardianProcess = spawn(
    process.execPath,
    [path.join(__dirname, "guardian/start.js")],
    {
      cwd: __dirname,
      stdio: ["inherit", "pipe", "pipe"],
      env: process.env,
      shell: false
    }
  );

  guardianProcess.stdout.on("data", data => {
    process.stdout.write(data);
  });

  guardianProcess.stderr.on("data", data => {
    process.stderr.write(data);
  });

  guardianProcess.on("error", error => {
    console.error("[Guardian error]", error.message);
  });

  guardianProcess.on("close", (code, signal) => {
    console.log(
      `[Guardian stopped] Code=${code}, Signal=${signal}`
    );

    guardianProcess = null;

    if (!shuttingDown) {
      restartTimer = setTimeout(() => {
        restartTimer = null;
        startGuardian();
      }, 5000);
    }
  });
}

const server = http.createServer((req, res) => {
  const pathname = new URL(
    req.url,
    `http://${req.headers.host || "localhost"}`
  ).pathname;

  if (pathname === "/" || pathname === "/health") {
    const running =
      guardianProcess !== null &&
      guardianProcess.exitCode === null;

    res.writeHead(running ? 200 : 503, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    });

    return res.end(JSON.stringify({
      service: "404-BOT",
      status: running ? "running" : "starting",
      guardian: running,
      telegram: Boolean(
        telegramProcess &&
        telegramProcess.exitCode === null
      ),
      uptime: Math.floor(process.uptime()),
      startedAt: new Date(startedAt).toISOString(),
      time: new Date().toISOString()
    }));
  }

  res.writeHead(404, {
    "Content-Type": "application/json"
  });

  res.end(JSON.stringify({ status: "not_found" }));
});

server.listen(PORT, HOST, () => {
  console.log(`[RENDER] Server running on ${HOST}:${PORT}`);
  console.log("[RENDER] Health endpoint: /health");

  startTelegram();
  startGuardian();
});

function shutdown(signal) {
  if (shuttingDown) return;

  shuttingDown = true;

  console.log(`[404 BOT] ${signal} received.`);

  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }

  if (guardianProcess && guardianProcess.exitCode === null) {
    guardianProcess.kill("SIGTERM");
  }

  if (telegramProcess && telegramProcess.exitCode === null) {
    telegramProcess.kill("SIGTERM");
  }

  server.close(() => process.exit(0));

  setTimeout(() => {
    if (guardianProcess && guardianProcess.exitCode === null) {
      guardianProcess.kill("SIGKILL");
    }

    if (telegramProcess && telegramProcess.exitCode === null) {
      telegramProcess.kill("SIGKILL");
    }

    process.exit(0);
  }, 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
