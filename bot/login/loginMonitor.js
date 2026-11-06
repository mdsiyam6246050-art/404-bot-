"use strict";

const STATES = Object.freeze({
    IDLE: "IDLE",
    CONNECTING: "CONNECTING",
    CONNECTED: "CONNECTED",
    DISCONNECTED: "DISCONNECTED",
    RECONNECTING: "RECONNECTING",
    FATAL: "FATAL"
});

class ConnectionMonitor {
    constructor(options = {}) {
        this.state = STATES.IDLE;

        this.baseDelay = options.baseDelay || 3000;
        this.maxDelay = options.maxDelay || 30000;

        this.heartbeatInterval =
            options.heartbeatInterval || 45000;

        this.reconnectAttempts = 0;
        this.totalReconnects = 0;

        this.lastActivity = Date.now();
        this.connectedAt = null;

        this.reconnecting = false;
        this.timer = null;
    }

    setState(state) {
        this.state = state;

        console.log(
            "[LOGIN MONITOR]",
            new Date().toISOString(),
            state
        );
    }

    markConnecting() {
        this.setState(STATES.CONNECTING);
    }

    markConnected() {
        this.connectedAt = Date.now();
        this.lastActivity = Date.now();
        this.reconnectAttempts = 0;

        this.setState(STATES.CONNECTED);
    }

    markDisconnected() {
        this.setState(STATES.DISCONNECTED);
    }

    markFatal() {
        this.setState(STATES.FATAL);
    }

    markActivity() {
        this.lastActivity = Date.now();
    }

    getDelay() {
        const delay = Math.min(
            this.maxDelay,
            this.baseDelay * Math.pow(1.5, this.reconnectAttempts)
        );

        return Math.floor(delay + Math.random() * 1000);
    }

    async reconnect(callback) {
        if (this.reconnecting) return false;

        this.reconnecting = true;

        try {
            while (this.state !== STATES.IDLE) {
                this.reconnectAttempts++;
                this.totalReconnects++;

                const delay = this.getDelay();

                this.setState(STATES.RECONNECTING);

                console.log(
                    `[LOGIN MONITOR] Retry ${this.reconnectAttempts} after ${delay}ms`
                );

                await new Promise(resolve =>
                    setTimeout(resolve, delay)
                );

                let success = false;

                try {
                    success = await callback();
                } catch (error) {
                    console.error(
                        "[LOGIN MONITOR] Reconnect error:",
                        error.message
                    );
                }

                if (success) {
                    this.markConnected();
                    return true;
                }
            }

            return false;

        } finally {
            this.reconnecting = false;
        }
    }

    getStatus() {
        return {
            state: this.state,
            reconnectAttempts: this.reconnectAttempts,
            totalReconnects: this.totalReconnects,
            lastActivity: this.lastActivity,
            uptime: this.connectedAt
                ? Date.now() - this.connectedAt
                : 0
        };
    }

    stop() {
        this.setState(STATES.IDLE);

        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}

module.exports = {
    ConnectionMonitor,
    STATES
};
