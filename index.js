/**
 * @author siyam
 * SIYAM HASAN - Messenger GoatBot Launcher
 * Facebook Messenger Only
 */

'use strict';

const {
    spawn
} = require('child_process');

const express =
    require('express');

const log =
    require('./logger/log.js');

const app =
    express();

const PORT =
    Number(
        process.env.PORT
    ) || 3000;

let guardianProcess =
    null;

let shuttingDown =
    false;

function startGuardian() {
    if (shuttingDown)
        return;

    log.info(
        'MESSENGER',
        'Starting SIYAM Messenger Cookie Guardian...'
    );

    guardianProcess =
        spawn(
            process.execPath,
            [
                'guardian/start.js'
            ],
            {
                cwd: __dirname,

                stdio: 'inherit',

                shell: false,

                env: {
                    ...process.env
                }
            }
        );

    guardianProcess.on(
        'error',
        error => {
            log.error(
                'MESSENGER',
                'Guardian startup error: ' +
                error.message
            );
        }
    );

    guardianProcess.on(
        'close',
        code => {
            guardianProcess =
                null;

            if (
                shuttingDown
            )
                return;

            log.info(
                'MESSENGER',
                'Guardian stopped with code: ' +
                code
            );

            setTimeout(
                startGuardian,
                5000
            );
        }
    );
}

app.get(
    '/',
    (req, res) => {
        res.status(
            200
        ).send(
            'SIYAM HASAN Messenger GoatBot is running!'
        );
    }
);

app.get(
    '/health',
    (req, res) => {
        res.status(
            200
        ).json({
            status: 'OK',

            platform:
                'Facebook Messenger',

            guardian:
                guardianProcess &&
                guardianProcess.exitCode ===
                    null
                    ? 'running'
                    : 'starting',

            uptime:
                process.uptime()
        });
    }
);

const server =
    app.listen(
        PORT,
        '0.0.0.0',
        () => {
            log.info(
                'SERVER',
                'SIYAM uptime server running on port ' +
                PORT
            );

            startGuardian();
        }
    );

function shutdown() {
    if (
        shuttingDown
    )
        return;

    shuttingDown =
        true;

    if (
        guardianProcess &&
        guardianProcess.exitCode ===
            null
    ) {
        guardianProcess.kill(
            'SIGTERM'
        );
    }

    server.close(
        () => {
            process.exit(
                0
            );
        }
    );

    setTimeout(
        () =>
            process.exit(
                0
            ),
        5000
    ).unref();
}

process.on(
    'SIGINT',
    shutdown
);

process.on(
    'SIGTERM',
    shutdown
);
