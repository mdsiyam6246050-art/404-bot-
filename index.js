"use strict";

/*
 * 404 BOT
 * Author: Siyam Hasan
 * Messenger Bot Launcher
 */

const http = require("http");
const { spawn } = require("child_process");
const path = require("path");

const notifier = require("./bot/telegram/notifier");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;

let botProcess = null;
let shuttingDown = false;
let restarting = false;
let hasStarted = false;

const server = http.createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
        res.writeHead(200, {
            "Content-Type": "application/json"
        });

        res.end(JSON.stringify({
            status: "running",
            name: "404 BOT",
            author: "Siyam Hasan",
            uptime: process.uptime()
        }));

        return;
    }

    res.writeHead(404, {
        "Content-Type": "text/plain"
    });

    res.end("Not Found");
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] 404 BOT running on port ${PORT}`);
});

const botEnv = { ...process.env };
delete botEnv.NODE_ENV;

function startBot() {
    if (shuttingDown || restarting) return;

    console.log("--------------------------------");
    console.log("        404 BOT");
    console.log("   Author: Siyam Hasan");
    console.log("--------------------------------");
    console.log("[BOT] Starting Messenger Bot...");

    botProcess = spawn(
        process.execPath,
        [path.join(ROOT, "Goat.js")],
        {
            cwd: ROOT,
            env: botEnv,
            stdio: "inherit",
            shell: false
        }
    );

    botProcess.on("error", error => {
        console.error("[BOT ERROR]", error.message);

        notifier.sendTelegramAlert("systemError", {
            source: "Bot Process",
            error: error.message
        }, {
            problemKey: "bot-process-error",
            dedupe: false
        }).catch(() => {});
    });

    botProcess.on("close", code => {
        botProcess = null;

        if (shuttingDown) return;

        if (code === 2) {
            console.log("[BOT] Restart requested.");

            restarting = true;

            setTimeout(() => {
                restarting = false;
                startBot();
            }, 2000);

            return;
        }

        console.log(`[BOT] Stopped. Exit code: ${code}`);

        notifier.sendTelegramAlert("systemError", {
            source: "Bot Process",
            error: `Messenger Bot stopped unexpectedly. Exit code: ${code}`
        }, {
            problemKey: "unexpected-bot-stop",
            dedupe: false
        }).catch(() => {});
    });

    if (!hasStarted) {
        hasStarted = true;

        notifier.sendTelegramAlert("startup", {
            name: "404 Messenger Bot",
            details: "Hosting server এবং Messenger Bot চালু হচ্ছে"
        }, {
            dedupe: false
        }).catch(() => {});
    } else {
        notifier.sendTelegramAlert("restart", {
            reason: "Messenger Bot restarted"
        }, {
            dedupe: false
        }).catch(() => {});
    }
}

function shutdown(signal) {
    if (shuttingDown) return;

    shuttingDown = true;

    console.log(`[SYSTEM] ${signal} received. Shutting down...`);

    notifier.sendTelegramAlert("shutdown", {
        reason: signal,
        details: "Hosting process বন্ধ হচ্ছে"
    }, {
        dedupe: false
    }).catch(() => {});

    if (botProcess) {
        botProcess.kill("SIGTERM");
    }

    server.close(() => {
        console.log("[SERVER] Closed.");
        process.exit(0);
    });

    setTimeout(() => {
        process.exit(0);
    }, 5000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startBot();
