// Copyright (c) 2024-2025 SAYU
// This software is released under the MIT License, see LICENSE.

/**
 * @file 自動ログイン機能を提供するモジュール
 */


/**
 * 保存されたユーザーIDとパスワード、TOTP秘密鍵を取得する。
 * @returns {Promise<{username?: string, password?: string, totpSecret?: string}>}
 */
async function getCredentials() {
    try {
        return await chrome.storage.local.get(["username", "password", "totpSecret"]);
    } catch (error) {
        console.error("[KLPF] ログイン情報の取得に失敗しました。", error);
        return {};
    }
}

/**
 * LMSの初期ログインページを処理する。
 * 統合認証ページへ遷移するために「ログイン」ボタンをクリック
 * @returns {boolean} 要素が見つかり処理できたか
 */
function handleLmsStartPage() {
    const loginButton = safeQuerySelector(`button[name='loginButton']`);
    if (loginButton) {
        loginButton.click();
        return true;
    }
    const loginLink = safeQuerySelector('a[href*="login"]');
    if (loginLink) {
        loginLink.click();
        return true;
    }
    return false;
}

/**
 * 統合認証のユーザー名入力ページ（prelogin.cgi）を処理する。
 * @param {string} username
 * @returns {boolean} 要素が見つかり処理できたか
 */
function handlePreLogin(username) {
    const usernameInput = safeQuerySelector("input[name='username']");
    const form = safeQuerySelector("form#login");

    if (usernameInput && form) {
        usernameInput.value = username;
        form.submit();
        return true;
    }
    return false;
}

/**
 * 統合認証のパスワード入力ページ（login.cgi）を処理する。
 * @param {string} password
 * @returns {boolean} 要素が見つかり処理できたか
 */
function handleLogin(password) {
    const passwordInput = safeQuerySelector("input[name='password']");
    const form = safeQuerySelector("form#login");

    if (passwordInput && form) {
        passwordInput.value = password;
        form.submit();
        return true;
    }
    return false;
}

// タイムアウトページからログインページへ復帰 (timeout.cgi)
function sso_timeoutpage() {
    location.pathname = "/user/";
}

// エラーページからログインページへ復帰
// 2025/9/1 エラーページの存在を確認できず。もしかしたら削除されてるかも
function lms_errorpage() {
    location.pathname = "/lms/lginLgir/";
}

/**
 * 統合認証のTOTP入力ページ（otplogin.cgi）を処理する。
 * @param {string} totpSecret - Base32エンコードされたTOTP秘密鍵
 * @returns {Promise<boolean>} 要素が見つかり処理できたか
 */
async function handleTotpPage(totpSecret) {
    
    if (!totpSecret) return true;

    const otpInput = safeQuerySelector(
        "input#password_input.onetime_input, input[autocomplete='one-time-code']"
    );
    if (!otpInput) return false;

    const code = await generateTOTP(totpSecret);
    if (!code) {
        console.error("[KLPF] TOTPコードの生成に失敗しました。秘密鍵を確認してください。");
        return true;
    }

    otpInput.value = code;
    otpInput.dispatchEvent(new Event('input', { bubbles: true }));
    otpInput.dispatchEvent(new Event('change', { bubbles: true }));

    // MFA記憶チェックボックスが存在すればチェックする
    const rememberCheckbox = safeQuerySelector("input#remember[name='remember']");
    if (rememberCheckbox && !rememberCheckbox.checked) {
        rememberCheckbox.click();
    }

    const form = safeQuerySelector("form#login");
    if (form) form.submit();
    return true;
}

/**
 * メイン処理
 * @returns {Promise<boolean>} URLに応じた処理を実行できたか。falseの場合、DOMContentLoadedイベントを待って再試行する必要がある。
 */
async function main() {
    const { username, password, totpSecret } = await getCredentials();

    if (!username || !password) {
        console.log("[KLPF] ユーザー名またはパスワードが未設定のため、自動ログインをスキップします。");
        return true; // 再試行不要
    }

    const { href } = window.location;

    if (href.startsWith(LMS_LOGIN_URL)) {
        return handleLmsStartPage();
    } else if (href.startsWith(SSO_PRELOGIN_URL)) {
        return handlePreLogin(username);
    } else if (href.startsWith(SSO_LOGIN_URL)) {
        return handleLogin(password);
    } else if (href.startsWith(SSO_OTP_URL)) {
        return await handleTotpPage(totpSecret);
    } else if (href.startsWith(SSO_TIMEOUT_URL)) {
        sso_timeoutpage();
        return true;
    } else if (href.startsWith(LMS_ERROR_URL)) {
        lms_errorpage();
        return true;
    }

    return true; // 対象外URL
}

async function initialize() {
    const handled = await main();
    if (!handled && document.readyState === 'loading') {
        document.addEventListener("DOMContentLoaded", () => main(), { once: true });
    }
}

initialize();
