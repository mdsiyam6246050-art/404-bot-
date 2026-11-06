'use strict';

/*
 * SIYAM Messenger Bot
 *
 * Guardian + GoatBot launcher
 *
 * কাজ:
 * Guardian → Facebook session check
 * Guardian → account.txt refresh
 * GoatBot → Messenger listener
 * Session dead → Guardian refresh
 * Fresh cookie পাওয়া গেলে → GoatBot restart
 */

const path = require('path');
const {
    spawn
} = require('child_process');

const guardian =
    require('./core');

const ROOT =
    path.resolve(
        __dirname,
        '..'
    );

const cfg =
    guardian.makeConfig();

const log =
    console.log;

let bot = null;
let stopGuardian = null;

let shuttingDown = false;
let deliberateRestart = false;

let lastSessionRecovery = 0;
let lastCookieWrite = 0;
let lastBotHealthy = 0;
let restartTimer = null;

const SESSION_ERROR_REGEX =
    /COOKIE_INVALID|Not logged in|not logged in|session.*expired|session.*invalid|login.*failed|login.*error|account.*inactive|Connection closed|Connection refused|LISTEN.*ERROR|listen.*error/i;

const BOT_OK_REGEX =
    /Login successful|loginSuccess|Login complete|BOT_STARTED|startBotSuccess|Listening|Bot started/i;

const ANSI_REGEX =
    /\x1b\[[0-9;]*m/g;

const RECOVERY_COOLDOWN =
    2 * 60 * 1000;

const RESTART_AFTER_COOKIE =
    3 * 60 * 1000;

function now() {
    return Date.now();
}

function scanLine(line) {
    const clean =
        String(line)
            .replace(
                ANSI_REGEX,
                ''
            );

    if (
        BOT_OK_REGEX.test(
            clean
        )
    ) {
        lastBotHealthy =
            now();
    }

    if (
        SESSION_ERROR_REGEX.test(
            clean
        ) &&
        now() -
            lastSessionRecovery >
            RECOVERY_COOLDOWN
    ) {
        recoverSession(
            'bot-log-detected-session-error'
        );
    }
}

async function recoverSession(
    reason
) {
    if (shuttingDown)
        return;

    if (
        now() -
            lastSessionRecovery <
        RECOVERY_COOLDOWN
    ) {
        return;
    }

    lastSessionRecovery =
        now();

    log(
        `[SIYAM GUARDIAN] Facebook session recovery শুরু: ${reason}`
    );

    try {
        const result =
            await guardian.syncOnce(
                cfg,
                {
                    force: true,
                    reason
                }
            );

        log(
            `[SIYAM GUARDIAN] recovery result: ${result.state}`
        );

        if (
            result.wrote
        ) {
            lastCookieWrite =
                now();

            scheduleBotRestart();
        }
    }
    catch (error) {
        log(
            `[SIYAM GUARDIAN] recovery error: ${error.message}`
        );
    }
}

function scheduleBotRestart() {
    if (restartTimer)
        clearTimeout(
            restartTimer
        );

    restartTimer =
        setTimeout(
            () => {
                restartTimer =
                    null;

                if (
                    shuttingDown
                )
                    return;

                if (
                    bot &&
                    bot.exitCode ===
                        null
                ) {
                    log(
                        '[SIYAM GUARDIAN] নতুন appstate পাওয়া গেছে — Messenger bot restart হচ্ছে'
                    );

                    deliberateRestart =
                        true;

                    bot.kill(
                        'SIGTERM'
                    );

                    setTimeout(
                        () => {
                            if (
                                bot &&
                                bot.exitCode ===
                                    null
                            ) {
                                bot.kill(
                                    'SIGKILL'
                                );
                            }
                        },
                        8000
                    ).unref();
                }
            },
            RESTART_AFTER_COOKIE
        );

    restartTimer.unref();
}

function pipeStream(
    stream,
    output
) {
    let buffer = '';

    stream.on(
        'data',
        chunk => {
            output.write(
                chunk
            );

            buffer +=
                chunk.toString(
                    'utf8'
                );

            let index;

            while (
                (index =
                    buffer.indexOf(
                        '\n'
                    )) !== -1
            ) {
                const line =
                    buffer.slice(
                        0,
                        index
                    );

                buffer =
                    buffer.slice(
                        index + 1
                    );

                scanLine(
                    line
                );
            }

            if (
                buffer.length >
                20000
            ) {
                buffer =
                    buffer.slice(
                        -4000
                    );
            }
        }
    );
}

function startBot() {
    if (shuttingDown)
        return;

    log(
        '[SIYAM GUARDIAN] GoatBot starting...'
    );

    bot =
        spawn(
            process.execPath,
            [
                path.join(
                    ROOT,
                    'Goat.js'
                )
            ],
            {
                cwd: ROOT,

                stdio: [
                    'inherit',
                    'pipe',
                    'pipe'
                ],

                shell: false,

                env: {
                    ...process.env
                }
            }
        );

    pipeStream(
        bot.stdout,
        process.stdout
    );

    pipeStream(
        bot.stderr,
        process.stderr
    );

    bot.on(
        'error',
        error => {
            log(
                `[SIYAM GUARDIAN] GoatBot process error: ${error.message}`
            );
        }
    );

    bot.on(
        'close',
        (code, signal) => {
            bot = null;

            if (
                shuttingDown
            ) {
                process.exit(
                    0
                );
            }

            if (
                deliberateRestart
            ) {
                deliberateRestart =
                    false;

                log(
                    '[SIYAM GUARDIAN] Bot recovery restart...'
                );

                setTimeout(
                    startBot,
                    2000
                );

                return;
            }

            if (
                code === 0 &&
                !signal
            ) {
                log(
                    '[SIYAM GUARDIAN] GoatBot stopped normally.'
                );

                process.exit(
                    0
                );
            }

            log(
                `[SIYAM GUARDIAN] GoatBot stopped. code=${code} signal=${signal || '-'}`
            );

            setTimeout(
                startBot,
                5000
            );
        }
    );
}

async function shutdown(
    signal
) {
    if (
        shuttingDown
    )
        return;

    shuttingDown =
        true;

    if (restartTimer) {
        clearTimeout(
            restartTimer
        );

        restartTimer =
            null;
    }

    if (
        stopGuardian
    ) {
        stopGuardian();

        stopGuardian =
            null;
    }

    if (
        bot &&
        bot.exitCode === null
    ) {
        bot.kill(
            signal
        );

        setTimeout(
            () =>
                process.exit(
                    0
                ),
            5000
        ).unref();

        return;
    }

    process.exit(
        0
    );
}

process.on(
    'SIGINT',
    () =>
        shutdown(
            'SIGINT'
        )
);

process.on(
    'SIGTERM',
    () =>
        shutdown(
            'SIGTERM'
        )
);

(async () => {
    log(
        '========================================'
    );

    log(
        '      SIYAM MESSENGER COOKIE GUARDIAN'
    );

    log(
        '========================================'
    );

    try {
        const result =
            await guardian.syncOnce(
                cfg,
                {
                    reason:
                        'startup'
                }
            );

        log(
            `[SIYAM GUARDIAN] startup session: ${result.state}`
        );

        stopGuardian =
            guardian.runForever(
                cfg,
                {
                    skipFirst:
                        true
                }
            );
    }
    catch (error) {
        log(
            `[SIYAM GUARDIAN] startup check failed: ${error.message}`
        );

        try {
            stopGuardian =
                guardian.runForever(
                    cfg,
                    {
                        skipFirst:
                            true
                    }
                );
        }
        catch (_) {}
    }

    startBot();
})();
