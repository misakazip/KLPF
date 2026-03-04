// ==UserScript==
// @name         KLPF AutoLogin
// @namespace    https://github.com/SAYUTIM/KLPF
// @version      1.0.0
// @description  工学院大学 LMS / 統合認証の自動ログイン (KLPF ユーザースクリプト版)
// @author       SAYU
// @license      MIT
// @match        https://study.ns.kogakuin.ac.jp/lms/lginLgir/*
// @match        https://study.ns.kogakuin.ac.jp/lms/error/*
// @match        https://slink.secioss.com/pub/prelogin.cgi*
// @match        https://slink.secioss.com/pub/login.cgi*
// @match        https://slink.secioss.com/pub/otplogin.cgi*
// @match        https://slink.secioss.com/sso/timeout.cgi*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(async function () {
    'use strict';

    // ============================================================
    //  ★ ここに自分の認証情報を入力してください ★
    // ============================================================
    const USERNAME   = '';   // ユーザーID (例: 'j1XXXXX')
    const PASSWORD   = '';   // パスワード
    const TOTP_SECRET = '';  // TOTP秘密鍵 (Base32) 未使用なら空文字のまま
    // ============================================================

    // --- URL定数 ---
    const LMS_URL        = 'https://study.ns.kogakuin.ac.jp/';
    const LMS_LOGIN_URL  = `${LMS_URL}lms/lginLgir/`;
    const LMS_ERROR_URL  = `${LMS_URL}lms/error/`;
    const KU_SSO         = 'https://slink.secioss.com/';
    const SSO_PRELOGIN_URL = `${KU_SSO}pub/prelogin.cgi`;
    const SSO_LOGIN_URL    = `${KU_SSO}pub/login.cgi`;
    const SSO_TIMEOUT_URL  = `${KU_SSO}sso/timeout.cgi`;
    const SSO_OTP_URL      = `${KU_SSO}pub/otplogin.cgi`;

    // --- ユーティリティ ---
    function safeQuerySelector(selector, root = document) {
        try {
            return root.querySelector(selector);
        } catch (e) {
            return null;
        }
    }

    // --- TOTP ---
    function base32Decode(encoded) {
        const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        const cleaned = encoded.replace(/[\s=\-]+/g, '').toUpperCase();
        if (!cleaned) return null;

        const len = cleaned.length;
        const out = new Uint8Array(((len * 5) / 8) | 0);
        let bits = 0, value = 0, index = 0;

        for (let i = 0; i < len; i++) {
            const val = ALPHABET.indexOf(cleaned[i]);
            if (val === -1) return null;
            value = (value << 5) | val;
            bits += 5;
            if (bits >= 8) {
                out[index++] = (value >>> (bits - 8)) & 0xff;
                bits -= 8;
            }
        }
        return out;
    }

    async function generateTOTP(secret, { period = 30, digits = 6, algorithm = 'SHA-1' } = {}) {
        try {
            const keyBytes = base32Decode(secret);
            if (!keyBytes || keyBytes.length === 0) return null;

            const epoch = Math.floor(Date.now() / 1000);
            const timeStep = Math.floor(epoch / period);

            const timeBuffer = new ArrayBuffer(8);
            new DataView(timeBuffer).setBigUint64(0, BigInt(timeStep), false);

            const cryptoKey = await crypto.subtle.importKey(
                'raw', keyBytes,
                { name: 'HMAC', hash: { name: algorithm } },
                false, ['sign']
            );

            const hmacResult = await crypto.subtle.sign('HMAC', cryptoKey, timeBuffer);
            const hmacBytes = new Uint8Array(hmacResult);

            const offset = hmacBytes[hmacBytes.length - 1] & 0x0f;
            const binary =
                ((hmacBytes[offset]     & 0x7f) << 24) |
                ((hmacBytes[offset + 1] & 0xff) << 16) |
                ((hmacBytes[offset + 2] & 0xff) <<  8) |
                 (hmacBytes[offset + 3] & 0xff);

            return (binary % Math.pow(10, digits)).toString().padStart(digits, '0');
        } catch (e) {
            console.error('[KLPF] TOTP生成失敗:', e);
            return null;
        }
    }

    // --- ページハンドラ ---
    function handleLmsStartPage() {
        const loginButton = safeQuerySelector("button[name='loginButton']");
        if (loginButton) { loginButton.click(); return true; }
        const loginLink = safeQuerySelector('a[href*="login"]');
        if (loginLink) { loginLink.click(); return true; }
        return false;
    }

    function handlePreLogin(username) {
        const usernameInput = safeQuerySelector("input[name='username']");
        const form = safeQuerySelector('form#login');
        if (usernameInput && form) {
            usernameInput.value = username;
            form.submit();
            return true;
        }
        return false;
    }

    function handleLogin(password) {
        const passwordInput = safeQuerySelector("input[name='password']");
        const form = safeQuerySelector('form#login');
        if (passwordInput && form) {
            passwordInput.value = password;
            form.submit();
            return true;
        }
        return false;
    }

    function sso_timeoutpage() {
        location.pathname = '/user/';
    }

    function lms_errorpage() {
        location.pathname = '/lms/lginLgir/';
    }

    async function handleTotpPage(totpSecret) {
        if (!totpSecret) return true;

        const otpInput = safeQuerySelector(
            "input#password_input.onetime_input, input[autocomplete='one-time-code']"
        );
        if (!otpInput) return false;

        const code = await generateTOTP(totpSecret);
        if (!code) {
            console.error('[KLPF] TOTPコードの生成に失敗しました。秘密鍵を確認してください。');
            return true;
        }

        otpInput.value = code;
        otpInput.dispatchEvent(new Event('input', { bubbles: true }));
        otpInput.dispatchEvent(new Event('change', { bubbles: true }));

        const rememberCheckbox = safeQuerySelector("input#remember[name='remember']");
        if (rememberCheckbox && !rememberCheckbox.checked) {
            rememberCheckbox.click();
        }

        const form = safeQuerySelector('form#login');
        if (form) form.submit();
        return true;
    }

    // --- メイン ---
    async function main() {
        if (!USERNAME || !PASSWORD) {
            console.log('[KLPF] ユーザー名またはパスワードが未設定のため、自動ログインをスキップします。');
            return true;
        }

        const { href } = window.location;

        if (href.startsWith(LMS_LOGIN_URL))    return handleLmsStartPage();
        if (href.startsWith(SSO_PRELOGIN_URL)) return handlePreLogin(USERNAME);
        if (href.startsWith(SSO_LOGIN_URL))    return handleLogin(PASSWORD);
        if (href.startsWith(SSO_OTP_URL))      return await handleTotpPage(TOTP_SECRET);
        if (href.startsWith(SSO_TIMEOUT_URL))  { sso_timeoutpage(); return true; }
        if (href.startsWith(LMS_ERROR_URL))    { lms_errorpage();   return true; }

        return true;
    }

    const handled = await main();
    if (!handled && document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => main(), { once: true });
    }
})();
