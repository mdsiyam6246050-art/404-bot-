
"use strict";

/*
 * 404 BOT
 * Author: Siyam Hasan
 * Messenger Bot Launcher + Watchdog
 */

const http = require("http");
const { spawn } = require("child_process");
const path = require("path");
const notifier = require("./bot/telegram/notifier");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const BOT_FILE = path.join(ROOT, "Goat.js");
const WORKER_MONITOR = path.join(ROOT, "bot/telegram/worker-monitor.js");

const HEARTBEAT_INTERVAL = 15000;
const HEARTBEAT_TIMEOUT = 90000;
const WATCHDOG_INTERVAL = 15000;
const STABLE_RUNTIME = 120000;
const MIN_RESTART_DELAY = 5000;
const MAX_RESTART_DELAY = 60000;

let botProcess = null;
let shuttingDown = false;
let restarting = false;
let hasStarted = false;
let outageReported = false;
let restartAttempts = 0;
let lastHeartbeat = 0;
let processStartedAt = 0;
let restartTimer = null;
let watchdogTimer = null;
let shutdownTimer = null;

function sendAlert(type, details, options = {}) {
    notifier.sendTelegramAlert(type, details, options).catch(error => {
        console.error("[Telegram Alert Error]", error.message);
    });
}

function getHealth() {
    const processAlive = Boolean(
        botProcess &&
        botProcess.exitCode === null &&
        !botProcess.killed
    );

    const heartbeatFresh =
        lastHeartbeat > 0 &&
        Date.now() - lastHeartbeat <= HEARTBEAT_TIMEOUT;

    const healthy = processAlive && heartbeatFresh && !shuttingDown;

    return {
        status: healthy ? "running" : "degraded",
        name: "404 BOT",
        author: "Siyam Hasan",
        messengerProcess: processAlive,
        heartbeat: lastHeartbeat
            ? new Date(lastHeartbeat).toISOString()
            : null,
        uptime: process.uptime()
    };
}

const server = http.createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
        const health = getHealth();

        res.writeHead(health.status === "running" ? 200 : 503, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
        });

        res.end(JSON.stringify(health));
        return;
    }

    res.writeHead(404, {
        "Content-Type": "text/plain"
    });

    res.end("Not Found");
});

server.on("error", error => {
    console.error("[HEALTH SERVER ERROR]", error.message);

    sendAlert("systemError", {
        source: "Health HTTP Server",
        error: error.message
    }, {
        problemKey: "health-http-server"
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] 404 BOT running on port ${PORT}`);
});

// Preserve the existing environment behavior of the repository.
const botEnv = { ...process.env };
delete botEnv.NODE_ENV;

function scheduleRestart(reason) {
    if (shuttingDown || restarting || restartTimer) return;

    restarting = true;
    restartAttempts += 1;

    const delay = Math.min(
        MIN_RESTART_DELAY * Math.pow(2, Math.min(restartAttempts - 1, 4)),
        MAX_RESTART_DELAY
    );

    console.error(
        `[WATCHDOG] Restarting Messenger Bot in ${delay}ms. Reason: ${reason}`
    );

    restartTimer = setTimeout(() => {
        restartTimer = null;
        restarting = false;
        startBot();
    }, delay);
}

function startBot() {
    if (shuttingDown || restarting || botProcess) return;

    console.log("--------------------------------");
    console.log("        404 BOT");
    console.log("   Author: Siyam Hasan");
    console.log("--------------------------------");
    console.log("[BOT] Starting Messenger Bot...");

    lastHeartbeat = 0;
    processStartedAt = Date.now();

    const child = spawn(
        process.execPath,
        ["-r", WORKER_MONITOR, BOT_FILE],
        {
            cwd: ROOT,
            env: botEnv,
            stdio: ["inherit", "inherit", "inherit", "ipc"],
            shell: false
        }
    );

    botProcess = child;

    child.on("message", message => {
        if (!message || typeof message !== "object") return;

        if (message.type === "404_BOT_HEARTBEAT") {
            lastHeartbeat = Date.now();

            if (
                restartAttempts > 0 &&
                Date.now() - processStartedAt >= STABLE_RUNTIME
            ) {
                restartAttempts = 0;
            }

            if (outageReported) {
                outageReported = false;

                sendAlert("recovered", {
                    problem: "Messenger Bot stopped or became unresponsive",
                    details: "Watchdog received a fresh heartbeat. Messenger Bot is responding again."
                }, {
                    problemKey: "messenger-process-outage",
                    recoveredKey: "messenger-process-outage"
                });
            }

            return;
        }

        if (message.type === "404_BOT_FATAL_ERROR") {
            outageReported = true;

            sendAlert("systemError", {
                source: message.source || "Messenger Worker",
                error: String(
                    message.error || "Unknown fatal error"
                ).slice(0, 2500)
            }, {
                problemKey: `worker-fatal:${message.source || "unknown"}`,
                dedupeWindowMs: 60000
            });
        }
    });

    child.on("error", error => {
        console.error("[BOT SPAWN ERROR]", error.message);

        outageReported = true;

        sendAlert("systemError", {
            source: "Bot Process Launcher",
            error: error.message
        }, {
            problemKey: "messenger-process-outage",
            dedupeWindowMs: 60000
        });
    });

    child.on("close", (code, signal) => {
        if (botProcess === child) {
            botProcess = null;
        }

        lastHeartbeat = 0;

        if (shuttingDown) return;

        if (code === 2) {
            console.log("[BOT] Intentional restart requested.");

            restarting = true;

            restartTimer = setTimeout(() => {
                restartTimer = null;
                restarting = false;
                startBot();
            }, 2000);

            return;
        }

        const reason =
            `Messenger Bot exited. Exit code: ${code}; Signal: ${signal || "none"}`;

        console.error(`[BOT] ${reason}`);

        outageReported = true;

        sendAlert("systemError", {
            source: "Messenger Bot Process",
            error: reason
        }, {
            problemKey: "messenger-process-outage",
            dedupeWindowMs: 60000
        });

        scheduleRestart(reason);
    });

    if (!hasStarted) {
        hasStarted = true;

        sendAlert("startup", {
            name: "404 Messenger Bot",
            details: "Hosting server এবং Messenger Bot চালু হচ্ছে"
        }, {
            dedupe: false
        });
    } else {
        sendAlert("restart", {
            reason: "Messenger Bot restarted by Watchdog"
        }, {
            dedupe: false
        });
    }
}

function watchdogCheck() {
    if (
        shuttingDown ||
        !botProcess ||
        botProcess.exitCode !== null
    ) {
        return;
    }

    const now = Date.now();

    if (!lastHeartbeat) {
        if (now - processStartedAt > HEARTBEAT_TIMEOUT) {
            const reason =
                "Worker did not send its first heartbeat before timeout.";

            console.error("[WATCHDOG]", reason);

            outageReported = true;

            sendAlert("systemError", {
                source: "Watchdog Heartbeat",
                error: reason
            }, {
                problemKey: "messenger-process-outage",
                dedupeWindowMs: 60000
            });

            botProcess.kill("SIGKILL");
        }

        return;
    }

    const silence = now - lastHeartbeat;

    if (silence > HEARTBEAT_TIMEOUT) {
        const reason =
            `Worker heartbeat timed out after ${Math.round(silence / 1000)} seconds.`;

        console.error("[WATCHDOG]", reason);

        outageReported = true;

        sendAlert("systemError", {
            source: "Watchdog Heartbeat",
            error: reason
        }, {
            problemKey: "messenger-process-outage",
            dedupeWindowMs: 60000
        });

        botProcess.kill("SIGKILL");
    }
}

function shutdown(signal) {
    if (shuttingDown) return;

    shuttingDown = true;

    console.log(`[SYSTEM] ${signal} received. Shutting down...`);

    sendAlert("shutdown", {
        reason: signal,
        details: "Hosting process বন্ধ হচ্ছে"
    }, {
        dedupe: false
    });

    if (watchdogTimer) clearInterval(watchdogTimer);
    if (restartTimer) clearTimeout(restartTimer);

    if (botProcess && botProcess.exitCode === null) {
        try {
            botProcess.send({
                type: "404_BOT_SHUTDOWN"
            });
        } catch (_) {}

        botProcess.kill("SIGTERM");
    }

    shutdownTimer = setTimeout(() => process.exit(0), 8000);
    shutdownTimer.unref();

    server.close(() => {
        if (shutdownTimer) clearTimeout(shutdownTimer);

        console.log("[SERVER] Closed.");
        process.exit(0);
    });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

watchdogTimer = setInterval(watchdogCheck, WATCHDOG_INTERVAL);

startBot();
