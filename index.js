
"use strict";

/*
 * Messenger Bot Launcher
 * Author: Siyam
 * Project: 404 BOT
 */

const fs = require("fs");
const path = require("path");

process.env.BLUEBIRD_W_FORGOTTEN_RETURN = "0";

const ROOT = __dirname;
const NODE_ENV = process.env.NODE_ENV || "production";
const IS_DEVELOPMENT = NODE_ENV === "development";

// ----------------------------------------
// CONFIG FILE RESOLVER
// ----------------------------------------

function resolveFile(name, extension) {
    const normalFile = path.join(
        ROOT,
        `${name}.${extension}`
    );

    const developmentFile = path.join(
        ROOT,
        `${name}.dev.${extension}`
    );

    if (
        IS_DEVELOPMENT &&
        fs.existsSync(developmentFile)
    ) {
        return developmentFile;
    }

    return normalFile;
}

const dirConfig = resolveFile("config", "json");
const dirConfigCommands = resolveFile("configCommands", "json");
const dirAccount = path.join(ROOT, "account.txt");

// ----------------------------------------
// JSON VALIDATION
// ----------------------------------------

function readJSON(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(
            `Required file not found: ${path.basename(filePath)}`
        );
    }

    try {
        return JSON.parse(
            fs.readFileSync(filePath, "utf8")
        );
    } catch (error) {
        throw new Error(
            `${path.basename(filePath)}: ${error.message}`
        );
    }
}

let config;
let configCommands;

try {
    config = readJSON(dirConfig);
    configCommands = readJSON(dirConfigCommands);
} catch (error) {
    console.error("[CONFIG ERROR]", error.message);
    process.exit(1);
}

// ----------------------------------------
// CONFIG NORMALIZATION
// ----------------------------------------

if (
    config.whiteListMode &&
    Array.isArray(config.whiteListMode.whiteListIds)
) {
    config.whiteListMode.whiteListIds =
        config.whiteListMode.whiteListIds.map(String);
}

configCommands.commandBanned ||= {};
configCommands.envGlobal ||= {};
configCommands.envCommands ||= {};
configCommands.envEvents ||= {};

// ----------------------------------------
// GLOBAL GOATBOT
// ----------------------------------------

global.GoatBot = {
    startTime: Date.now(),

    commands: new Map(),
    eventCommands: new Map(),

    commandFilesPath: [],
    eventCommandsFilesPath: [],

    aliases: new Map(),

    onFirstChat: [],
    onChat: [],
    onEvent: [],
    onReply: new Map(),
    onReaction: new Map(),
    onAnyEvent: [],

    config,
    configCommands,

    envCommands: {},
    envEvents: {},
    envGlobal: {},

    reLoginBot: function () {},

    Listening: null,
    oldListening: [],

    callbackListenTime: {},
    storage5Message: [],

    fcaApi: null,
    botID: null
};

// ----------------------------------------
// GLOBAL DATABASE
// ----------------------------------------

global.db = {
    allThreadData: [],
    allUserData: [],
    allDashBoardData: [],
    allGlobalData: [],

    threadModel: null,
    userModel: null,
    dashboardModel: null,
    globalModel: null,

    threadsData: null,
    usersData: null,
    dashBoardData: null,
    globalData: null,

    receivedTheFirstMessage: {}
};

// ----------------------------------------
// GLOBAL CLIENT
// ----------------------------------------

global.client = {
    dirConfig,
    dirConfigCommands,
    dirAccount,

    countDown: {},
    cache: {},

    database: {
        creatingThreadData: [],
        creatingUserData: [],
        creatingDashBoardData: [],
        creatingGlobalData: []
    },

    commandBanned: configCommands.commandBanned
};

// ----------------------------------------
// GLOBAL UTILS
// ----------------------------------------

const utils = require("./utils.js");

global.utils = utils;

// ----------------------------------------
// GLOBAL TEMP
// ----------------------------------------

global.temp = {
    createThreadData: [],
    createUserData: [],

    createThreadDataError: [],

    filesOfGoogleDrive: {
        arraybuffer: {},
        stream: {},
        fileNames: {}
    },

    contentScripts: {
        cmds: {},
        events: {}
    }
};

// ----------------------------------------
// CONFIG RELOAD
// ----------------------------------------

function watchConfig(filePath, property, label) {
    fs.watchFile(
        filePath,
        {
            interval: 1000
        },
        (current, previous) => {
            if (
                current.mtimeMs === previous.mtimeMs
            ) {
                return;
            }

            try {
                const updated = readJSON(filePath);

                if (property === "config") {
                    if (
                        updated.whiteListMode &&
                        Array.isArray(
                            updated.whiteListMode.whiteListIds
                        )
                    ) {
                        updated.whiteListMode.whiteListIds =
                            updated.whiteListMode.whiteListIds.map(String);
                    }
                }

                global.GoatBot[property] = updated;

                if (property === "configCommands") {
                    global.GoatBot.envGlobal =
                        updated.envGlobal || {};

                    global.GoatBot.envCommands =
                        updated.envCommands || {};

                    global.GoatBot.envEvents =
                        updated.envEvents || {};

                    global.client.commandBanned =
                        updated.commandBanned || {};
                }

                console.log(
                    `[CONFIG] ${label} reloaded successfully.`
                );
            } catch (error) {
                console.error(
                    `[CONFIG] ${label} reload failed:`,
                    error.message
                );
            }
        }
    );
}

watchConfig(
    dirConfig,
    "config",
    "config.json"
);

watchConfig(
    dirConfigCommands,
    "configCommands",
    "configCommands.json"
);

// ----------------------------------------
// LOAD ENV CONFIGURATION
// ----------------------------------------

global.GoatBot.envGlobal =
    configCommands.envGlobal || {};

global.GoatBot.envCommands =
    configCommands.envCommands || {};

global.GoatBot.envEvents =
    configCommands.envEvents || {};

// ----------------------------------------
// AUTO RESTART
// ----------------------------------------

const getText = utils.getText;

if (config.autoRestart?.time) {
    const restartTime = config.autoRestart.time;

    if (
        typeof restartTime === "number" &&
        Number.isFinite(restartTime) &&
        restartTime > 0
    ) {
        console.log(
            `[AUTO RESTART] Restart scheduled in ${restartTime}ms.`
        );

        setTimeout(() => {
            console.log("[AUTO RESTART] Restarting Messenger...");
            process.exit(2);
        }, restartTime);
    } else if (
        typeof restartTime === "string" &&
        restartTime.trim()
    ) {
        try {
            const cron = require("node-cron");

            if (cron.validate(restartTime)) {
                cron.schedule(restartTime, () => {
                    console.log(
                        "[AUTO RESTART] Restarting Messenger..."
                    );

                    process.exit(2);
                });
            }
        } catch (error) {
            console.error(
                "[AUTO RESTART ERROR]",
                error.message
            );
        }
    }
}

// ----------------------------------------
// START MESSENGER LOGIN
// ----------------------------------------

console.log("----------------------------------------");
console.log("       404 BOT - MESSENGER");
console.log("       Author: Siyam");
console.log("----------------------------------------");

console.log("[MESSENGER] Loading login system...");

try {
    require("./bot/login/login.js");
} catch (error) {
    console.error(
        "[MESSENGER LOGIN ERROR]",
        error.stack || error.message
    );

    process.exit(1);
}

// ----------------------------------------
// PROCESS ERROR HANDLING
// ----------------------------------------

process.on("unhandledRejection", error => {
    console.error(
        "[MESSENGER PROMISE ERROR]",
        error?.stack || error
    );
});

process.on("uncaughtException", error => {
    console.error(
        "[MESSENGER FATAL ERROR]",
        error?.stack || error
    );
});
