"use strict";

const http = require("http");
const { spawn } = require("child_process");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

let botProcess = null;
let shuttingDown = false;

function startBot() {
  if (shuttingDown) return;

  const goatPath = path.join(__dirname, "Goat.js");

  console.log("[SIYAM] Starting Goat.js...");

  botProcess = spawn(
    process.execPath,
    [goatPath],
    {
      cwd: __dirname,
      stdio: ["inherit", "pipe", "pipe"],
      env: process.env
    }
  );

  botProcess.stdout.on("data", (data) => {
    process.stdout.write(`[GOAT] ${data}`);
  });

  botProcess.stderr.on("data", (data) => {
    process.stderr.write(`[GOAT ERROR] ${data}`);
  });

  botProcess.on("error", (error) => {
    console.error("[SIYAM] Failed to start Goat.js:", error);
  });

  botProcess.on("exit", (code, signal) => {
    console.log(
      `[SIYAM] Goat.js stopped. code=${code}, signal=${signal}`
    );

    botProcess = null;

    if (shuttingDown) return;

    setTimeout(() => {
      startBot();
    }, 5000);
  });
}

/*
 * Render health server
 */
const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    });

    res.end(
      JSON.stringify({
        status: "ok",
        bot: "SIYAM",
        uptime: Math.floor(process.uptime()),
        botRunning: Boolean(botProcess),
        time: new Date().toISOString()
      })
    );

    return;
  }

  res.writeHead(404, {
    "Content-Type": "application/json; charset=utf-8"
  });

  res.end(
    JSON.stringify({
      status: "not_found"
    })
  );
});

server.listen(PORT, HOST, () => {
  console.log(`[RENDER] Health server listening on port ${PORT}`);
  console.log(`[RENDER] Health URL: /health`);

  startBot();
});

/*
 * Graceful shutdown
 */
function shutdown(signal) {
  if (shuttingDown) return;

  shuttingDown = true;

  console.log(`[SIYAM] ${signal} received. Shutting down...`);

  if (botProcess) {
    botProcess.kill("SIGTERM");
  }

  server.close(() => {
    process.exit(0);
  });

  setTimeout(() => {
    process.exit(0);
  }, 10000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
