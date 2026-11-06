'use strict';

const crypto = require('crypto');

function base32Decode(input) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const clean = String(input)
        .replace(/[\s=-]/g, '')
        .toUpperCase();

    let bits = '';

    for (const char of clean) {
        const index = alphabet.indexOf(char);

        if (index < 0)
            throw new Error('FB_TOTP_SECRET is not valid base32');

        bits += index.toString(2).padStart(5, '0');
    }

    const bytes = [];

    for (let i = 0; i + 8 <= bits.length; i += 8)
        bytes.push(parseInt(bits.slice(i, i + 8), 2));

    return Buffer.from(bytes);
}

function totp(secret, now = Date.now(), step = 30, digits = 6) {
    const key = base32Decode(secret);

    const counter = Math.floor(now / 1000 / step);

    const buffer = Buffer.alloc(8);

    buffer.writeBigUInt64BE(BigInt(counter));

    const hmac = crypto
        .createHmac('sha1', key)
        .update(buffer)
        .digest();

    const offset = hmac[hmac.length - 1] & 0xf;

    const code =
        ((hmac[offset] & 0x7f) << 24) |
        (hmac[offset + 1] << 16) |
        (hmac[offset + 2] << 8) |
        hmac[offset + 3];

    return String(code % 10 ** digits).padStart(digits, '0');
}

module.exports = {
    totp,
    base32Decode
};
