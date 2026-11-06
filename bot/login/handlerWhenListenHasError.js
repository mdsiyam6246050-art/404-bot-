"use strict";

const notifier = require("../telegram/notifier");

module.exports = async function ({
    api,
    threadModel,
    userModel,
    dashBoardModel,
    globalModel,
    threadsData,
    usersData,
    dashBoardData,
    globalData,
    error
}) {
    const config = global.GoatBot.config || {};
    const botID = global.GoatBot.botID || "N/A";

    const errorText = error?.stack ||
        error?.message ||
        String(error || "Unknown Messenger Error");

    const lowerError = errorText.toLowerCase();

    const isLogout =
        lowerError.includes("not logged in") ||
        lowerError.includes("not logged in.") ||
        lowerError.includes("cookie_invalid") ||
        lowerError.includes("token_error") ||
        lowerError.includes("account_error") ||
        lowerError.includes("can't login") ||
        lowerError.includes("cannot login");

    const details = {
        account: config.facebookAccount?.email || "Facebook Account",
        uid: botID,
        error: errorText.slice(0, 2500)
    };

    try {
        if (isLogout) {
            await notifier.sendTelegramAlert(
                "logout",
                details,
                {
                    problemKey: "facebook-logout"
                }
            );
        } else {
            await notifier.sendTelegramAlert(
                "listenerError",
                {
                    event: "Messenger MQTT Listener",
                    error: errorText.slice(0, 2500)
                },
                {
                    problemKey: "messenger-listener-error"
                }
            );
        }

        console.error(
            "[Messenger Listener Error]",
            errorText
        );

    } catch (err) {
        console.error(
            "[Telegram Listener Notification]",
            err.message
        );
    }

    // Existing Gmail notification
    const gmail = config.notiWhenListenMqttError?.gmail;

    if (gmail?.enable && global.utils?.sendMail) {
        const addresses = String(
            gmail.emailGetNoti || ""
        ).split(/[,;\s]+/).filter(Boolean);

        for (const email of addresses) {
            try {
                await global.utils.sendMail({
                    to: email,
                    subject: "Messenger Bot Listener Error",
                    text: errorText
                });
            } catch (err) {
                console.error("[MAIL ERROR]", err.message);
            }
        }
    }

    // Existing Discord notification
    const discord = config.notiWhenListenMqttError?.discordHook;

    if (discord?.enable && discord.webhookUrl) {
        const axios = require("axios");

        const urls = String(discord.webhookUrl)
            .split(/[,;\s]+/)
            .filter(Boolean);

        for (const url of urls) {
            try {
                await axios.post(url, {
                    content:
                        `Messenger Bot Listener Error\n` +
                        `Bot UID: ${botID}\n` +
                        `Error: ${errorText.slice(0, 1500)}`
                });
            } catch (err) {
                console.error("[DISCORD ERROR]", err.message);
            }
        }
    }
};
