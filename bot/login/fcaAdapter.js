"use strict";

function normalizeApi(api) {
    if (!api || typeof api !== "object") {
        throw new Error("Invalid FCA API");
    }

    if (api.__404Normalized) {
        return api;
    }

    Object.defineProperty(api, "__404Normalized", {
        value: true,
        configurable: false
    });

    if (
        typeof api.listenMqtt !== "function" &&
        typeof api.listen === "function"
    ) {
        api.listenMqtt = api.listen.bind(api);
    }

    return api;
}

module.exports = {
    normalizeApi
};
