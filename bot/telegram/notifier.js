"use strict";

const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const ROOT = path.join(__dirname, "../..");
const CONFIG_PATH = path.join(ROOT, "config.json");
const STATE_PATH = path.join(ROOT, "data/telegram-alert-state.json");

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

    return [...new Set(
        [...admins, ...owners, ...groups]
            .filter(Boolean)
            .map(String)
    )];
}

function readState() {
    try {
        return fs.readJsonSync(STATE_PATH);
    } catch {
        return { activeProblems: {} };
    }
}

function saveState(state) {
    fs.ensureDirSync(path.dirname(STATE_PATH));

    const temp = STATE_PATH + ".tmp";

    fs.writeJsonSync(temp, state, { spaces: 2 });

    fs.moveSync(temp, STATE_PATH, { overwrite: true });
}

async function sendTelegramAlert(type, details = {}, options = {}) {
    try {
        const config = readConfig();
        const tg = config.telegram || {};
        const notifications = tg.notifications || {};

        if (tg.enable === false) return false;
        if (notifications.enable === false) return false;
        if (notifications[type] === false) return false;

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

        const state = readState();
        state.activeProblems ||= {};

        if (type === "recovered") {
            const recoveredKey = String(
                options.recoveredKey || problemKey
            );

            if (!state.activeProblems[recoveredKey]) {
                return false;
            }

            delete state.activeProblems[recoveredKey];
            saveState(state);
        } else if (options.dedupe !== false) {
            if (state.activeProblems[problemKey]) {
                return false;
            }

            state.activeProblems[problemKey] = {
                type,
                time: Date.now()
            };

            saveState(state);
        }

        let message = design(details);

        if (message.length > 3900) {
            message = message.slice(0, 3900) + "\n... (Too long)";
        }

        const results = await Promise.allSettled(
            recipients.map(chatId =>
                axios.post(
                    `https://api.telegram.org/bot${token}/sendMessage`,
                    {
                        chat_id: chatId,
                        text: message,
                        disable_web_page_preview: true
                    },
                    { timeout: 15000 }
                )
            )
        );

        const failed = results.filter(
            result => result.status === "rejected"
        );

        if (failed.length) {
            console.error(
                "[Telegram] Delivery failed:",
                failed.length,
                "recipient(s)"
            );
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
