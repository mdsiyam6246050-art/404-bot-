'use strict';

/*
 * SIYAM Messenger Bot
 * Cookie Guardian
 *
 * Adapted from the session-recovery architecture used by MR-JUWEL.
 *
 * কাজ:
 * 1. account.txt থেকে বর্তমান appstate ব্যবহার করা
 * 2. Facebook browser session পরীক্ষা করা
 * 3. session invalid হলে credentials দিয়ে login করার চেষ্টা করা
 * 4. নতুন cookies account.txt-এ atomicভাবে লেখা
 * 5. account.txt.bak রাখা
 * 6. 2FA থাকলে TOTP ব্যবহার করা
 * 7. checkpoint/captcha হলে human intervention চাওয়া
 */

const fs = require('fs');
const path = require('path');
const { totp } = require('./totp');

const ROOT = path.resolve(__dirname, '..');

const APPSTATE_PATH = path.join(ROOT, 'account.txt');
const BACKUP_PATH = APPSTATE_PATH + '.bak';

const SESSION_KEYS = ['c_user', 'xs'];

const CODE_SELECTOR =
    'input[name="approvals_code"], input[autocomplete="one-time-code"], input[name="code"]';

let running = false;

function stamp() {
    return new Date()
        .toISOString()
        .replace('T', ' ')
        .slice(0, 19);
}

function log(message, level = 'info') {
    const prefix =
        level === 'error'
            ? '[guardian ERROR]'
            : level === 'warn'
                ? '[guardian WARN]'
                : '[guardian]';

    console.log(`${prefix} ${stamp()} ${message}`);
}

function loadEnvFile() {
    const envPath = path.join(ROOT, '.env');

    if (!fs.existsSync(envPath))
        return;

    try {
        const content = fs.readFileSync(envPath, 'utf8');

        for (const line of content.split(/\r?\n/)) {
            const trimmed = line.trim();

            if (!trimmed || trimmed.startsWith('#'))
                continue;

            const match = trimmed.match(
                /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/
            );

            if (!match)
                continue;

            let value = match[2].trim();

            if (
                (value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))
            ) {
                value = value.slice(1, -1);
            }

            if (process.env[match[1]] === undefined)
                process.env[match[1]] = value;
        }
    }
    catch (_) {}
}

function numberEnv(name, fallback) {
    const value = Number(process.env[name]);

    return Number.isFinite(value)
        ? value
        : fallback;
}

function makeConfig() {
    loadEnvFile();

    return {
        root: ROOT,

        appstatePath:
            path.resolve(
                process.env.APPSTATE_PATH || APPSTATE_PATH
            ),

        backupPath:
            path.resolve(
                process.env.APPSTATE_BACKUP_PATH || BACKUP_PATH
            ),

        stateDir:
            path.resolve(
                process.env.GUARDIAN_DIR ||
                path.join(ROOT, '.guardian')
            ),

        profileDir:
            path.resolve(
                process.env.FB_PROFILE_DIR ||
                path.join(
                    ROOT,
                    '.guardian',
                    'facebook-profile'
                )
            ),

        baseUrl:
            (
                process.env.FB_BASE_URL ||
                'https://www.facebook.com'
            ).replace(/\/+$/, ''),

        email:
            process.env.FB_EMAIL ||
            process.env.FACEBOOK_EMAIL ||
            'bot213418@gmail.com',

        password:
            process.env.FB_PASSWORD ||
            process.env.FACEBOOK_PASSWORD ||
            'farhan420@',

        totpSecret:
            process.env.FB_TOTP_SECRET ||
            process.env.FACEBOOK_TOTP_SECRET ||
            '',

        userAgent:
            process.env.FB_USER_AGENT ||
            'Mozilla/5.0 (Linux; Android 12; M2102J20SG) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.0.0 Mobile Safari/537.36',

        intervalMs:
            numberEnv(
                'GUARDIAN_INTERVAL_MIN',
                15
            ) * 60 * 1000,

        loginCooldownMs:
            numberEnv(
                'GUARDIAN_LOGIN_COOLDOWN_MIN',
                30
            ) * 60 * 1000,

        maxLoginFailures:
            numberEnv(
                'GUARDIAN_MAX_LOGIN_FAILURES',
                3
            ),

        navigationTimeout: 45000,

        headless:
            !/^(0|false|no)$/i.test(
                process.env.FB_HEADLESS || 'true'
            )
    };
}

function ensureStateDirectory(cfg) {
    fs.mkdirSync(cfg.stateDir, {
        recursive: true
    });

    const gitignore =
        path.join(
            cfg.stateDir,
            '.gitignore'
        );

    if (!fs.existsSync(gitignore)) {
        fs.writeFileSync(
            gitignore,
            '*\n',
            'utf8'
        );
    }
}

function statusPath(cfg) {
    return path.join(
        cfg.stateDir,
        'status.json'
    );
}

function readStatus(cfg) {
    try {
        return JSON.parse(
            fs.readFileSync(
                statusPath(cfg),
                'utf8'
            )
        );
    }
    catch (_) {
        return {};
    }
}

function writeStatus(cfg, data) {
    ensureStateDirectory(cfg);

    const current = readStatus(cfg);

    const next = {
        ...current,
        ...data,
        updatedAt: new Date().toISOString()
    };

    fs.writeFileSync(
        statusPath(cfg),
        JSON.stringify(
            next,
            null,
            2
        ),
        {
            mode: 0o600
        }
    );

    return next;
}

function readAppState(cfg) {
    try {
        const data = JSON.parse(
            fs.readFileSync(
                cfg.appstatePath,
                'utf8'
            )
        );

        return Array.isArray(data)
            ? data
            : null;
    }
    catch (_) {
        return null;
    }
}

function getCookieValue(cookies, key) {
    const cookie = (cookies || []).find(
        item =>
            (item.key || item.name) === key
    );

    return cookie
        ? cookie.value
        : undefined;
}

function hasSession(cookies) {
    return SESSION_KEYS.every(
        key =>
            Boolean(
                getCookieValue(
                    cookies,
                    key
                )
            )
    );
}

function writeAppState(cfg, cookies) {
    if (!Array.isArray(cookies))
        throw new Error('Invalid appstate');

    if (!hasSession(cookies))
        throw new Error(
            'New Facebook session does not contain c_user/xs'
        );

    ensureStateDirectory(cfg);

    if (fs.existsSync(cfg.appstatePath)) {
        try {
            fs.copyFileSync(
                cfg.appstatePath,
                cfg.backupPath
            );
        }
        catch (_) {}
    }

    const temporary =
        cfg.appstatePath +
        '.guardian.tmp';

    fs.writeFileSync(
        temporary,
        JSON.stringify(
            cookies,
            null,
            4
        ),
        {
            encoding: 'utf8',
            mode: 0o600
        }
    );

    fs.renameSync(
        temporary,
        cfg.appstatePath
    );
}

function normalizeCookie(cookie, cfg) {
    return {
        key: cookie.name,
        value: cookie.value,
        domain: String(
            cookie.domain ||
            new URL(cfg.baseUrl).hostname
        ).replace(/^\./, ''),
        path: cookie.path || '/',
        hostOnly:
            !String(
                cookie.domain || ''
            ).startsWith('.'),
        creation:
            new Date().toISOString(),
        lastAccessed:
            new Date().toISOString()
    };
}

function toAppState(cfg, cookies) {
    const hostname =
        new URL(cfg.baseUrl).hostname;

    const result = [];
    const seen = new Set();

    for (const cookie of cookies) {
        const domain =
            String(
                cookie.domain || ''
            ).replace(/^\./, '');

        if (
            domain !== hostname &&
            !hostname.endsWith('.' + domain) &&
            !domain.endsWith('.' + hostname)
        ) {
            continue;
        }

        const key =
            `${cookie.name}|${domain}|${cookie.path || '/'}`;

        if (seen.has(key))
            continue;

        seen.add(key);

        result.push(
            normalizeCookie(
                cookie,
                cfg
            )
        );
    }

    return result;
}

function toBrowserCookies(cfg, appstate) {
    return appstate
        .filter(
            cookie =>
                cookie &&
                cookie.key &&
                typeof cookie.value === 'string'
        )
        .map(cookie => ({
            name: cookie.key,
            value: cookie.value,
            domain:
                cookie.hostOnly
                    ? cookie.domain
                    : '.' +
                        String(
                            cookie.domain ||
                            new URL(
                                cfg.baseUrl
                            ).hostname
                        ).replace(/^\./, ''),
            path:
                cookie.path || '/',
            secure:
                cfg.baseUrl.startsWith('https'),
            expires:
                Math.floor(
                    Date.now() / 1000
                ) + 180 * 86400
        }));
}

function loadPlaywright() {
    try {
        return require('playwright');
    }
    catch (_) {
        const error =
            new Error(
                'Playwright is not installed'
            );

        error.code =
            'PLAYWRIGHT_MISSING';

        throw error;
    }
}

async function openBrowser(cfg) {
    const playwright =
        loadPlaywright();

    ensureStateDirectory(cfg);

    const context =
        await playwright.chromium.launchPersistentContext(
            cfg.profileDir,
            {
                headless:
                    cfg.headless,

                viewport: {
                    width: 1280,
                    height: 800
                },

                locale: 'en-US',

                userAgent:
                    cfg.userAgent,

                args: [
                    '--disable-blink-features=AutomationControlled'
                ]
            }
        );

    return {
        context,

        close:
            async () => {
                await context
                    .close()
                    .catch(() => {});
            }
    };
}

async function settle(page, delay = 1500) {
    await page
        .waitForLoadState(
            'domcontentloaded',
            {
                timeout: 15000
            }
        )
        .catch(() => {});

    await page
        .waitForTimeout(delay);
}

async function navigate(cfg, page, url) {
    await page.goto(
        cfg.baseUrl + url,
        {
            waitUntil:
                'domcontentloaded',
            timeout:
                cfg.navigationTimeout
        }
    );

    await settle(page);
}

async function dismissCookieBanner(page) {
    const selectors = [
        'button:has-text("Allow all cookies")',
        'button:has-text("Accept all")',
        'button:has-text("Allow essential and optional cookies")',
        'button:has-text("Decline optional cookies")'
    ];

    for (const selector of selectors) {
        try {
            const button =
                page.locator(selector)
                    .first();

            if (
                await button.count() &&
                await button.isVisible()
            ) {
                await button.click({
                    timeout: 1500
                });

                await page.waitForTimeout(
                    500
                );

                break;
            }
        }
        catch (_) {}
    }
}

async function inspect(cfg, context, page) {
    const cookies =
        await context.cookies(
            cfg.baseUrl
        );

    const session =
        hasSession(cookies);

    let currentPath = '/';

    try {
        currentPath =
            new URL(
                page.url()
            ).pathname;
    }
    catch (_) {}

    const loginForm =
        await page
            .locator(
                'input[name="pass"]'
            )
            .count()
            .catch(() => 0);

    const codeInput =
        await page
            .locator(
                CODE_SELECTOR
            )
            .count()
            .catch(() => 0);

    const captcha =
        await page
            .locator(
                'iframe[src*="recaptcha"], img[src*="captcha"]'
            )
            .count()
            .catch(() => 0);

    let kind = null;

    if (codeInput)
        kind = '2fa';

    else if (
        /checkpoint|two_step_verification|recover|login\/identify/i
            .test(currentPath)
    )
        kind = 'checkpoint';

    else if (captcha)
        kind = 'captcha';

    const loggedIn =
        session &&
        !loginForm &&
        !kind &&
        !/^\/login/i.test(
            currentPath
        );

    return {
        loggedIn,
        kind,
        loginForm: Boolean(loginForm),
        session,
        pathname: currentPath
    };
}

async function loginWithCredentials(
    cfg,
    context,
    page
) {
    if (!cfg.email || !cfg.password) {
        return {
            ok: false,
            reason: 'credentials_missing'
        };
    }

    /*
     * শুধু c_user/xs পরিষ্কার করি।
     *
     * datr/sb রেখে দেওয়া হচ্ছে যাতে Facebook
     * একই device/browser profile হিসেবে চিনতে পারে।
     */
    for (const name of SESSION_KEYS) {
        await context
            .clearCookies({
                name
            })
            .catch(() => {});
    }

    await navigate(
        cfg,
        page,
        '/login'
    );

    await dismissCookieBanner(
        page
    );

    const email =
        page
            .locator(
                'input[name="email"]'
            )
            .first();

    const password =
        page
            .locator(
                'input[name="pass"]'
            )
            .first();

    if (
        !(await email.count()) ||
        !(await password.count())
    ) {
        return {
            ok: false,
            reason:
                'login_form_not_found'
        };
    }

    await email.fill(
        cfg.email
    );

    await password.fill(
        cfg.password
    );

    await password.press(
        'Enter'
    );

    await settle(
        page,
        4000
    );

    for (
        let attempt = 0;
        attempt < 8;
        attempt++
    ) {
        const state =
            await inspect(
                cfg,
                context,
                page
            );

        if (state.loggedIn) {
            return {
                ok: true
            };
        }

        if (
            state.kind ===
            'captcha'
        ) {
            return {
                ok: false,
                reason:
                    'needs_human:captcha'
            };
        }

        if (
            state.kind ===
            'checkpoint'
        ) {
            return {
                ok: false,
                reason:
                    'needs_human:checkpoint'
            };
        }

        if (
            state.kind ===
            '2fa'
        ) {
            if (!cfg.totpSecret) {
                return {
                    ok: false,
                    reason:
                        'needs_human:2fa_no_secret'
                };
            }

            try {
                const code =
                    totp(
                        cfg.totpSecret
                    );

                const input =
                    page
                        .locator(
                            CODE_SELECTOR
                        )
                        .first();

                await input.fill(
                    code
                );

                await input.press(
                    'Enter'
                );

                await settle(
                    page,
                    3000
                );

                continue;
            }
            catch (error) {
                return {
                    ok: false,
                    reason:
                        '2fa_error:' +
                        error.message
                };
            }
        }

        const trustButtons =
            page.getByRole(
                'button',
                {
                    name:
                        /trust this device|save browser|remember browser|continue|ok/i
                }
            );

        if (
            await trustButtons
                .count()
                .catch(() => 0)
        ) {
            await trustButtons
                .first()
                .click({
                    timeout: 3000
                })
                .catch(() => {});

            await settle(
                page,
                2000
            );

            continue;
        }

        const body =
            await page
                .locator('body')
                .innerText()
                .catch(() => '');

        if (
            /incorrect|wrong password|invalid username|not match any account/i
                .test(body)
        ) {
            return {
                ok: false,
                reason:
                    'bad_credentials'
            };
        }

        await page.waitForTimeout(
            2500
        );
    }

    return {
        ok: false,
        reason:
            'login_failed_unknown'
    };
}

async function syncOnce(
    cfg,
    options = {}
) {
    if (running) {
        return {
            state: 'busy'
        };
    }

    running = true;

    let browser = null;

    try {
        ensureStateDirectory(
            cfg
        );

        const status =
            readStatus(cfg);

        browser =
            await openBrowser(
                cfg
            );

        const context =
            browser.context;

        const page =
            context.pages()[0] ||
            await context.newPage();

        let currentCookies =
            await context.cookies(
                cfg.baseUrl
            );

        const currentHasSession =
            hasSession(
                currentCookies
            );

        const existing =
            readAppState(cfg);

        /*
         * Browser profile-এ session না থাকলে
         * account.txt-এর বর্তমান appstate বসিয়ে দিই।
         */
        if (
            !currentHasSession &&
            existing &&
            hasSession(existing)
        ) {
            await context.addCookies(
                toBrowserCookies(
                    cfg,
                    existing
                )
            );

            log(
                'account.txt থেকে browser session restore করা হয়েছে'
            );
        }

        await navigate(
            cfg,
            page,
            '/'
        );

        await dismissCookieBanner(
            page
        );

        let state =
            await inspect(
                cfg,
                context,
                page
            );

        if (!state.loggedIn) {
            log(
                `Facebook session invalid (${state.kind || 'logged-out'})`,
                'warn'
            );

            if (
                state.kind ===
                    'captcha' ||
                state.kind ===
                    'checkpoint'
            ) {
                writeStatus(
                    cfg,
                    {
                        state:
                            'needs_human',
                        reason:
                            state.kind,
                        blocked:
                            true
                    }
                );

                return {
                    state:
                        'needs_human',
                    reason:
                        state.kind
                };
            }

     
