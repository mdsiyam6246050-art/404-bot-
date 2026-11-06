
"use strict";

const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const ROOT = path.join(__dirname, "../..");
const CONFIG_PATH = path.join(ROOT, "config.json");
const STATE_PATH = path.join(ROOT, "data/telegram-alert-state.json");

const DEFAULT_DEDUPE_WINDOW = 5 * 60 * 1000;

const ALERT_DESIGNS = {
    startup: d => `
👑 SIYAM-HASAN
━━━━━━━━━━━━━━━━
🚀 BOT STARTED
🤖 BOT: ${d.name || "404 Messenger Bot"}
🟢 STATUS: ONLINE
⚙️ DETAILS: ${d.details || "বট সফলভাবে চালু হয়েছে"}
━━━━━━━━━━━━━━━━
🧚‍♀️ NIJHUM CHATBOT`,

    messengerStart: d => `
👑 SIYAM-HASAN
━━━━━━━━━━━━━━━━
💬 MESSENGER CONNECTED
👤 ACCOUNT: ${d.account || "Facebook"}
🆔 UID: ${d.uid || "N/A"}
🟢 STATUS: ACTIVE
━━━━━━━━━━━━━━━━
🧚‍♀️ NIJHUM CHATBOT`,

    restart: d => `
👑 SIYAM-HASAN
━━━━━━━━━━━━━━━━
🔄 BOT RESTARTED
♻️ বট আবার চালু হয়েছে
🛠️ REASON: ${d.reason || "Process Restart"}
⏰ TIME: ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}
🟢 STATUS: RUNNING
━━━━━━━━━━━━━━━━
🧚‍♀️ NIJHUM CHATBOT`,

    logout: d => `
👑 SIYAM-HASAN
━━━━━━━━━━━━━━━━
🚪 FACEBOOK LOGOUT
😫 Messenger আইডি লগআউট হয়েছে
👤 ACCOUNT: ${d.account || "Facebook"}
🆔 UID: ${d.uid || "N/A"}
❌ ERROR: ${d.error || "Session Ended"}
🔐 ACTION: আবার লগইন পরীক্ষা করুন
━━━━━━━━━━━━━━━━
🧚‍♀️ NIJHUM CHATBOT`,

    loginError: d => `
👑 SIYAM-HASAN
━━━━━━━━━━━━━━━━
🔑 LOGIN FAILED
🔰 লগইন ব্যর্থ হয়েছে
👤 ACCOUNT: ${d.account || "Facebook"}
🆔 UID: ${d.uid || "N/A"}
⚠️ ERROR: ${d.error || "Login Failed"}
🔴 STATUS: FAILED
━━━━━━━━━━━━━━━━
🧚‍♀️ NIJHUM CHATBOT`,

    cookieError: d => `
👑 SIYAM-HASAN
━━━━━━━━━━━━━━━━
🍪 COOKIE / SESSION ERROR
🪯 কুকি বা সেশন সমস্যা
👤 ACCOUNT: ${d.account || "Facebook"}
🆔 UID: ${d.uid || "N/A"}
🐛 ERROR: ${d.error || "Invalid Session"}
🔴 STATUS: INVALID
━━━━━━━━━━━━━━━━
🧚‍♀️ NIJHUM CHATBOT`,

    listenerError: d => `
👑 SIYAM-HASAN
━━━━━━━━━━━━━━━━
🎧 LISTENER ERROR
🫷 Messenger Listener-এ সমস্যা
📡 EVENT: ${d.event || "Messenger Listener"}
🧯 ERROR: ${d.error || "Unknown Listener Error"}
🚨 STATUS: ERROR DETECTED
━━━━━━━━━━━━━━━━
🧚‍♀️ NIJHUM CHATBOT`,

    commandError: d => `
👑 SIYAM-HASAN
━━━━━━━━━━━━━━━━
⌨️ COMMAND ERROR
😔 কমান্ডে সমস্যা
📝 COMMAND: ${d.command || "Unknown"}
👤 USER UID: ${d.uid || "N/A"}
👥 GROUP ID: ${d.groupID || "N/A"}
🐛 ERROR: ${d.error || "Command Failed"}
🔴 STATUS: FAILED
━━━━━━━━━━━━━━━━
🧚‍♀️ NIJHUM CHATBOT`,

    eventError: d => `
👑 SIYAM-HASAN
━━━━━━━━━━━━━━━━
🎯 EVENT ERROR
😔 ইভেন্টে সমস্যা
📌 EVENT: ${d.event || "Unknown"}
🐛 ERROR: ${d.error || "Event Failed"}
🔴 STATUS: FAILED
━━━━━━━━━━━━━━━━
🧚‍♀️ NIJHUM CHATBOT`,

    databaseError: d => `
👑 SIYAM-HASAN
━━━━━━━━━━━━━━━━
🗄️ DATABASE ERROR
📂 SOURCE: ${d.source || "Database"}
🐛 ERROR: ${d.error || "Database Failed"}
🔴 STATUS: FAILED
━━━━━━━━━━━━━━━━
🧚‍♀️ NIJHUM CHATBOT`,

    systemError: d => `
👑 SIYAM-HASAN
━━━━━━━━━━━━━━━━
🚨 SYSTEM ERROR
🖥️ SOURCE: ${d.source || "System"}
🧨 ERROR: ${d.error || "Unknown System Error"}
🔴 STATUS: CRITICAL
━━━━━━━━━━━━━━━━
🧚‍♀️ NIJHUM CHATBOT`,

    guardianError: d => `
👑 SIYAM-HASAN
━━━━━━━━━━━━━━━━
🛡️ GUARDIAN ERROR
⚙️ PROCESS: ${d.process || "Guardian"}
🧯 ERROR: ${d.error || "Guardian Failed"}
🔴 STATUS: FAILED
━━━━━━━━━━━━━━━━
🧚‍♀️ NIJHUM CHATBOT`,

    shutdown: d => `
👑 SIYAM-HASAN
━━━━━━━━━━━━━━━━
🌙 BOT STOPPED
♻️ বট বন্ধ হয়েছে
📴 REASON: ${d.reason || "Process Stopped"}
🔴 STATUS: OFFLINE
━━━━━━━━━━━━━━━━
🧚‍♀️ NIJHUM CHATBOT`,

    recovered: d => `
👑 SIYAM-HASAN
━━━━━━━━━━━━━━━━
🩹 PROBLEM FIXED
😊 সমস্যা সমাধান হয়েছে
🔧 PROBLEM: ${d.problem || "Unknown"}
🟢 STATUS: RECOVERED
✨ DETAILS: ${d.details || "System Normal"}
━━━━━━━━━━━━━━━━
🧚‍♀️ NIJHUM CHATBOT`
};

function readConfig() {
    try {
        return fs.readJsonSync(CONFIG_PATH);
    } catch (error) {
        console.error("[Telegram] Config read error:", error.message);
        return {};
    }
}

function getRecipients(config) {
    const tg = config.telegram || {};

    const admins = Array.isArray(tg.adminUID)
        ? tg.adminUID
        : [tg.adminUID];

    const owners = Array.isArray(tg.ownerUID)
        ? tg.ownerUID
        : [tg.ownerUID];

    const groups = Array.isArray(tg.groupIDs)
        ? tg.groupIDs
        : [tg.groupIDs];

    return [
        ...new Set(
            [...admins, ...owners, ...groups]
                .filter(Boolean)
                .map(String)
        )
    ];
}

function readState() {
    try {
        const state = fs.readJsonSync(STATE_PATH);

        if (!state || typeof state !== "object") {
            return { activeProblems: {} };
        }

        state.activeProblems ||= {};

        return state;
    } catch (_) {
        return { activeProblems: {} };
    }
}

function saveState(state) {
    fs.ensureDirSync(path.dirname(STATE_PATH));

    const tempPath = `${STATE_PATH}.tmp`;

    fs.writeJsonSync(tempPath, state, {
        spaces: 2
    });

    fs.moveSync(tempPath, STATE_PATH, {
        overwrite: true
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendToTelegram(token, chatId, message) {
    let lastError;

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            await axios.post(
                `https://api.telegram.org/bot${token}/sendMessage`,
                {
                    chat_id: chatId,
                    text: message,
                    disable_web_page_preview: true
                },
                {
                    timeout: 15000
                }
            );

            return true;
        } catch (error) {
            lastError = error;

            const retryAfter = Number(
                error.response?.data?.parameters?.retry_after || 0
            );

            if (attempt < 3) {
                await sleep(
                    retryAfter > 0
                        ? retryAfter * 1000
                        : attempt * 1500
                );
            }
        }
    }

    throw lastError || new Error("Telegram delivery failed");
}

async function sendTelegramAlert(type, details = {}, options = {}) {
    try {
        const config = readConfig();
        const tg = config.telegram || {};
        const notifications = tg.notifications || {};

        if (tg.enable === false || notifications.enable === false) {
            return false;
        }

        if (notifications[type] === false) {
            return false;
        }

        const design = ALERT_DESIGNS[type];

        if (!design) return false;

        const token =
            process.env.TELEGRAM_BOT_TOKEN ||
            tg.botToken;

        if (!token) {
            console.warn("[Telegram] Bot token missing");
            return false;
        }

        const recipients = getRecipients(config);

        if (!recipients.length) return false;

        const problemKey = String(options.problemKey || type);

        const recoveredKey = String(
            options.recoveredKey || problemKey
        );

        const isRecovery = type === "recovered";

        const state = readState();
        const now = Date.now();

        if (isRecovery && !state.activeProblems[recoveredKey]) {
            return false;
        }

        if (!isRecovery && options.dedupe !== false) {
            const previous = state.activeProblems[problemKey];

            const windowMs = Number(options.dedupeWindowMs) > 0
                ? Number(options.dedupeWindowMs)
                : DEFAULT_DEDUPE_WINDOW;

            if (
                previous &&
                now - Number(previous.time || 0) < windowMs
            ) {
                return false;
            }
        }

        let message = design(details || {});

        if (message.length > 3900) {
            message = message.slice(0, 3900) + "\n... (Too long)";
        }

        const results = await Promise.allSettled(
            recipients.map(chatId =>
                sendToTelegram(token, chatId, message)
            )
        );

        const failed = results.filter(
            result => result.status === "rejected"
        );

        if (failed.length) {
            console.error(
                "[Telegram] Delivery failed:",
                failed.length,
                "of",
                recipients.length,
                "recipient(s)"
            );
        }

        // Update saved state only after successful delivery.
        if (failed.length === 0) {
            if (isRecovery) {
                delete state.activeProblems[recoveredKey];
                saveState(state);
            } else if (options.dedupe !== false) {
                state.activeProblems[problemKey] = {
                    type,
                    time: now
                };

                saveState(state);
            }
        }

        return failed.length === 0;

    } catch (error) {
        console.error(
            "[Telegram Notifier Error]",
            error.message
        );

        return false;
    }
}

module.exports = {
    sendTelegramAlert,
    ALERT_DESIGNS
};
