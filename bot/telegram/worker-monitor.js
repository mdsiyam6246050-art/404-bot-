
"use strict";

const HEARTBEAT_INTERVAL = 15000;

let stopped = false;

function sendToParent(message) {
    if (
        stopped ||
        typeof process.send !== "function" ||
        !process.connected
    ) {
        return;
    }

    try {
        process.send(message);
    } catch (_) {
        // Parent process may already be shutting down.
    }
}

function sendHeartbeat() {
    sendToParent({
        type: "404_BOT_HEARTBEAT",
        time: Date.now()
    });
}

sendHeartbeat();

const heartbeatTimer = setInterval(
    sendHeartbeat,
    HEARTBEAT_INTERVAL
);

process.on("message", message => {
    if (message && message.type === "404_BOT_SHUTDOWN") {
        stopped = true;
        clearInterval(heartbeatTimer);
    }
});

process.on("unhandledRejection", reason => {
    const error =
        reason && (reason.stack || reason.message)
            ? (reason.stack || reason.message)
            : String(reason || "Unknown unhandled rejection");

    sendToParent({
        type: "404_BOT_FATAL_ERROR",
        source: "Worker Unhandled Rejection",
        error: String(error).slice(0, 2500)
    });
});

process.on("uncaughtExceptionMonitor", error => {
    stopped = true;
    clearInterval(heartbeatTimer);

    sendToParent({
        type: "404_BOT_FATAL_ERROR",
        source: "Worker Uncaught Exception",
        error: String(
            error && (error.stack || error.message) ||
            error ||
            "Unknown uncaught exception"
        ).slice(0, 2500)
    });
});

process.on("exit", () => {
    stopped = true;
    clearInterval(heartbeatTimer);
});
      
