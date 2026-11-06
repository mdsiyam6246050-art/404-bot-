"use strict";

const FATAL_PATTERNS = [
    /checkpoint/i,
    /account.*(locked|disabled|restricted|suspended)/i,
    /session.*(expired|invalid|revoked)/i,
    /not logged in/i,
    /invalid.*(cookie|appstate|session)/i,
    /login approval/i,
    /two.factor/i,
    /c_user.*missing/i,
    /authorization.*denied/i,
    /account_inactive/i
];

const TRANSIENT_PATTERNS = [
    /econnreset/i,
    /econnrefused/i,
    /etimedout/i,
    /enotfound/i,
    /eai_again/i,
    /socket hang up/i,
    /network error/i,
    /mqtt/i,
    /connection.*closed/i,
    /connection.*lost/i,
    /timeout/i,
    /429/,
    /502/,
    /503/,
    /504/
];

function errorText(error) {
    if (!error) return "";

    if (typeof error === "string") {
        return error;
    }

    return String(
        error.message ||
        error.error ||
        JSON.stringify(error)
    );
}

function classifyError(error) {
    const message = errorText(error);

    if (FATAL_PATTERNS.some(pattern => pattern.test(message))) {
        return "FATAL";
    }

    if (TRANSIENT_PATTERNS.some(pattern => pattern.test(message))) {
        return "TRANSIENT";
    }

    return "UNKNOWN";
}

function isFatal(error) {
    return classifyError(error) === "FATAL";
}

function isTransient(error) {
    return classifyError(error) === "TRANSIENT";
}

function validateSession(api) {
    try {
        if (!api) {
            return {
                ok: false,
                reason: "API missing"
            };
        }

        if (typeof api.getCurrentUserID !== "function") {
            return {
                ok: false,
                reason: "getCurrentUserID unavailable"
            };
        }

        const id = api.getCurrentUserID();

        return {
            ok: Boolean(id),
            userID: id ? String(id) : null
        };

    } catch (error) {
        return {
            ok: false,
            reason: errorText(error)
        };
    }
}

module.exports = {
    errorText,
    classifyError,
    isFatal,
    isTransient,
    validateSession
};
