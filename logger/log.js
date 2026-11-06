"use strict";

const { colors } = require("../func/colors.js");
const moment = require("moment-timezone");

const notifier = require("../bot/telegram/notifier");

const characters = "";

const getCurrentTime = () =>
    colors.gray(
        moment()
            .tz("Asia/Dhaka")
            .format("HH:mm:ss DD/MM/YYYY")
    );

function getErrorText(error) {
    if (error === undefined || error === null) {
        return "Unknown Error";
    }

    if (error instanceof Error) {
        return error.stack || error.message;
    }

    if (typeof error === "object") {
        try {
            return JSON.stringify(error, null, 2);
        } catch {
            return String(error);
        }
    }

    return String(error);
}

function detectErrorType(prefix, message) {
    const text = String(prefix || "").toLowerCase();

    if (
        text.includes("onstart") ||
        text.includes("onchat") ||
        text.includes("onreply") ||
        text.includes("onreaction") ||
        text.includes("command")
    ) {
        return "commandError";
    }

    if (
        text.includes("onevent") ||
        text.includes("event command") ||
        text.includes("event")
    ) {
        return "eventError";
    }

    if (text.includes("database") || text.includes("sequelize")) {
        return "databaseError";
    }

    return "systemError";
}

function sendErrorNotification(prefix, message, errors) {
    const type = detectErrorType(prefix, message);

    const errorText = [
        message,
        ...errors.map(getErrorText)
    ].join("\n\n").slice(0, 2500);

    notifier.sendTelegramAlert(
        type,
        {
            command: prefix || "Unknown",
            event: prefix || "Unknown",
            source: prefix || "System",
            error: errorText
        },
        {
            problemKey: `${type}:${prefix || "unknown"}`,
            dedupe: true
        }
    ).catch(err => {
        console.error(
            "[Telegram Error Notification]",
            err.message
        );
    });
}

function logError(prefix, message) {
    if (message === undefined) {
        message = prefix;
        prefix = "ERROR";
    }

    console.log(
        `${getCurrentTime()} ${colors.redBright(
            `${characters} ${prefix}:`
        )}`,
        message
    );

    const errors = Object.values(arguments).slice(2);

    for (let err of errors) {
        if (typeof err === "object" && err !== null && !err.stack) {
            err = getErrorText(err);
        }

        console.log(
            `${getCurrentTime()} ${colors.redBright(
                `${characters} ${prefix}:`
            )}`,
            err
        );
    }

    sendErrorNotification(prefix, message, errors);
}

module.exports = {
    err: logError,
    error: logError,

    warn: function (prefix, message) {
        if (message === undefined) {
            message = prefix;
            prefix = "WARN";
        }

        console.log(
            `${getCurrentTime()} ${colors.yellowBright(
                `${characters} ${prefix}:`
            )}`,
            message
        );
    },

    info: function (prefix, message) {
        if (message === undefined) {
            message = prefix;
            prefix = "INFO";
        }

        console.log(
            `${getCurrentTime()} ${colors.greenBright(
                `${characters} ${prefix}:`
            )}`,
            message
        );
    },

    success: function (prefix, message) {
        if (message === undefined) {
            message = prefix;
            prefix = "SUCCESS";
        }

        console.log(
            `${getCurrentTime()} ${colors.cyanBright(
                `${characters} ${prefix}:`
            )}`,
            message
        );
    },

    master: function (prefix, message) {
        if (message === undefined) {
            message = prefix;
            prefix = "MASTER";
        }

        console.log(
            `${getCurrentTime()} ${colors.hex(
                "#eb6734",
                `${characters} ${prefix}:`
            )}`,
            message
        );
    },

    dev: (...args) => {
        if (
            ["development", "production"].includes(
                process.env.NODE_ENV
            ) === false
        ) {
            return;
        }

        try {
            throw new Error();
        } catch (err) {
            const at = err.stack.split("\n")[2];

            let position = at.slice(
                at.indexOf(process.cwd()) + process.cwd().length + 1
            );

            if (position.endsWith(")")) {
                position = position.slice(0, -1);
            }

            console.log(
                `\x1b[36m${position} =>\x1b[0m`,
                ...args
            );
        }
    }
};
