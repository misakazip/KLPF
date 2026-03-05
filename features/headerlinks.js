// Copyright (c) 2024-2025 SAYU
// This software is released under the MIT License, see LICENSE.

/**
 * @file LMSヘッダーにカスタムリンクを追加する機能。
 * ユーザーが設定したリンクをヘッダーの「lms-header-title-text」エリアに表示する。
 */

(async function () {
    'use strict';

    // デフォルトのリンク一覧
    const DEFAULT_LINKS = [
        { name: 'KU-PORT', url: 'https://ku-port.sc.kogakuin.ac.jp/' },
    ];

    // ヘッダータイトルテキスト領域が表示されるまで待機
    const headerTitleText = await waitForElement('#lms-header-title-text');
    if (!headerTitleText) return;

    // ストレージからカスタムリンクを取得
    const { headerLinks } = await chrome.storage.sync.get({ headerLinks: DEFAULT_LINKS });

    if (!headerLinks || headerLinks.length === 0) return;

    // リンクコンテナを作成
    const linksContainer = document.createElement('div');
    linksContainer.id = 'klpf-header-links';
    linksContainer.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 12px;
        margin-left: 16px;
        vertical-align: middle;
    `;

    for (const link of headerLinks) {
        const a = document.createElement('a');
        a.href = link.url;
        a.textContent = link.name;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.style.cssText = `
            color: #1a73e8;
            text-decoration: none;
            font-size: 13px;
            font-weight: 500;
            padding: 4px 10px;
            border-radius: 4px;
            background: rgba(26, 115, 232, 0.08);
            transition: background 0.2s, color 0.2s;
            white-space: nowrap;
        `;
        a.addEventListener('mouseenter', () => {
            a.style.background = 'rgba(26, 115, 232, 0.18)';
        });
        a.addEventListener('mouseleave', () => {
            a.style.background = 'rgba(26, 115, 232, 0.08)';
        });
        linksContainer.appendChild(a);
    }

    // ヘッダータイトルテキストの隣に挿入
    headerTitleText.style.display = 'inline-flex';
    headerTitleText.style.alignItems = 'center';
    headerTitleText.appendChild(linksContainer);

    console.log('[KLPF] ヘッダーリンク機能を初期化しました。');
})();
