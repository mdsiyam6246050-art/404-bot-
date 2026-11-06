"use strict";

const fs = require("fs");
const path = require("path");

const REQUIRED_COOKIES = ["c_user", "xs"];

function log(message) {
    console.log("[APPSTATE]", message);
}

function getAppStatePath() {
    const config = global.GoatBot?.config || {};
    const fileName = config.APPSTATEPATH || "appstate.json";

    return path.resolve(
        process.env.APPSTATE_PATH || path.join(process.cwd(), fileName)
    );
}

function validateAppState(data) {
    if (!Array.isArray(data) || data.length === 0) {
        return { valid: false, reason: "AppState empty or invalid" };
    }

    for (const cookie of data) {
        if (
            !cookie ||
            typeof cookie !== "object" ||
            typeof cookie.key !== "string" ||
            typeof cookie.value !== "string"
        ) {
            return { valid: false, reason: "Invalid cookie entry" };
        }
    }

    const keys = new Set(data.map(cookie => cookie.key));

    for (const key of REQUIRED_COOKIES) {
        if (!keys.has(key)) {
            return {
                valid: false,
                reason: `Missing ${key} cookie`
            };
        }
    }

    return { valid: true };
}

function loadAppState(filePath) {
    const file = path.resolve(filePath || getAppStatePath());

    if (!fs.existsSync(file)) {
        throw new Error("AppState file not found: " + file);
    }

    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const check = validateAppState(data);

    if (!check.valid) {
        throw new Error(check.reason);
    }

    return data;
}

function backupAppState(filePath) {
    const file = path.resolve(filePath || getAppStatePath());

    if (!fs.existsSync(file)) return false;

    try {
        fs.copyFileSync(file, file + ".bak");
        return true;
    } catch (error) {
        log("Backup failed: " + error.message);
        return false;
    }
}

function saveAppState(appState, filePath) {
    const file = path.resolve(filePath || getAppStatePath());
    const check = validateAppState(appState);

    if (!check.valid) {
        log("Rejected AppState: " + check.reason);
        return false;
    }

    try {
        const dir = path.dirname(file);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (fs.existsSync(file)) {
            backupAppState(file);
        }

        const tempFile = file + ".tmp";

        fs.writeFileSync(
            tempFile,
            JSON.stringify(appState, null, 2),
            { encoding: "utf8", mode: 0o600 }
        );

        fs.renameSync(tempFile, file);

        try {
            fs.chmodSync(file, 0o600);
        } catch (_) {}

        log("AppState saved successfully");
        return true;

    } catch (error) {
        log("Save failed: " + error.message);
        return false;
    }
}

function getCookieString(appState) {
    if (!Array.isArray(appState)) return "";

    return appState
        .filter(cookie => cookie && cookie.key && cookie.value)
        .map(cookie => `${cookie.key}=${cookie.value}`)
        .join("; ");
}

module.exports = {
    REQUIRED_COOKIES,
    getAppStatePath,
    validateAppState,
    loadAppState,
    saveAppState,
    backupAppState,
    getCookieString
};
