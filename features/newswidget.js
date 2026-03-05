// Copyright (c) 2024-2025 SAYU
// This software is released under the MIT License, see LICENSE.

/**
 * @file お知らせ・トピックブロックを右下のフローティングウィジェットに移動する機能。
 * ホーム画面でのみ動作し、折りたたみ可能な小さな枠として表示する。
 */

(async function () {
    'use strict';

    // お知らせブロックが表示されるまで待機
    const firstNewsBlock = await waitForElement('.lms-news-block');
    if (!firstNewsBlock) return;

    // 全てのお知らせ/トピックブロックを取得
    const newsBlocks = safeQuerySelectorAll('.lms-news-block');
    if (newsBlocks.length === 0) return;

    // --- CSS注入 ---
    const style = document.createElement('style');
    style.textContent = `
        #klpf-news-widget {
            position: fixed;
            bottom: 16px;
            right: 16px;
            width: 340px;
            max-height: 80vh;
            background: #fff;
            border-radius: 10px;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.18), 0 1px 4px rgba(0, 0, 0, 0.08);
            z-index: 9999;
            font-family: inherit;
            overflow: hidden;
            transition: box-shadow 0.2s;
            display: flex;
            flex-direction: column;
        }
        #klpf-news-widget:hover {
            box-shadow: 0 6px 32px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.12);
        }

        #klpf-news-widget-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            background: linear-gradient(135deg, #1a73e8, #0d5bbd);
            color: #fff;
            cursor: pointer;
            user-select: none;
            border-radius: 10px 10px 0 0;
            font-size: 13px;
            font-weight: 600;
        }
        #klpf-news-widget.collapsed #klpf-news-widget-header {
            border-radius: 10px;
        }

        #klpf-news-widget-toggle {
            font-size: 16px;
            transition: transform 0.25s;
            line-height: 1;
        }
        #klpf-news-widget.collapsed #klpf-news-widget-toggle {
            transform: rotate(180deg);
        }

        #klpf-news-widget-body {
            overflow-y: auto;
            max-height: 60vh;
            padding: 0;
            transition: max-height 0.3s ease, padding 0.3s ease;
        }
        #klpf-news-widget.collapsed #klpf-news-widget-body {
            max-height: 0;
            padding: 0;
            overflow: hidden;
        }

        /* ブロックのスタイル調整 */
        #klpf-news-widget .lms-news-block {
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            width: 100% !important;
            float: none !important;
        }
        #klpf-news-widget .lms-news-title {
            padding: 8px 14px 4px !important;
            font-size: 12px !important;
            font-weight: 600 !important;
            color: #333 !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            border-bottom: 1px solid #eee !important;
            background: #fafafa !important;
        }
        #klpf-news-widget .lms-news-title > span:first-child {
            font-size: 12px !important;
        }
        #klpf-news-widget .lms-all-show a {
            font-size: 11px !important;
            color: #1a73e8 !important;
        }
        #klpf-news-widget .lms-news-contents {
            padding: 4px 14px 8px !important;
        }
        #klpf-news-widget .lms-news-subO {
            list-style: none !important;
            margin: 0 !important;
            padding: 4px 0 !important;
            font-size: 11.5px !important;
            line-height: 1.5 !important;
            border-bottom: 1px solid #f0f0f0 !important;
            display: flex !important;
            gap: 6px !important;
        }
        #klpf-news-widget .lms-news-subO:last-child {
            border-bottom: none !important;
        }
        #klpf-news-widget .lms-news-subO a {
            color: #1a73e8 !important;
            text-decoration: none !important;
            font-size: 11.5px !important;
        }
        #klpf-news-widget .lms-news-subO a:hover {
            text-decoration: underline !important;
        }

        /* 区切り線 */
        #klpf-news-widget .klpf-news-divider {
            border: none;
            border-top: 1px solid #e0e0e0;
            margin: 0;
        }

        /* バッジ */
        #klpf-news-widget-badge {
            background: #ff4444;
            color: #fff;
            font-size: 10px;
            font-weight: 700;
            border-radius: 10px;
            padding: 1px 7px;
            margin-left: 8px;
            line-height: 1.4;
        }
        #klpf-news-widget-badge.read {
            background: #888;
        }

        /* 既読ボタン */
        #klpf-news-mark-read {
            background: none;
            border: 1px solid rgba(255,255,255,0.6);
            color: #fff;
            font-size: 11px;
            padding: 3px 10px;
            border-radius: 4px;
            cursor: pointer;
            margin-left: auto;
            margin-right: 8px;
            transition: background 0.2s, border-color 0.2s;
            white-space: nowrap;
        }
        #klpf-news-mark-read:hover {
            background: rgba(255,255,255,0.15);
            border-color: #fff;
        }
        #klpf-news-mark-read.done {
            opacity: 0.5;
            pointer-events: none;
        }
    `;
    document.head.appendChild(style);

    // --- ウィジェット構築 ---
    const widget = document.createElement('div');
    widget.id = 'klpf-news-widget';

    // 最新のお知らせ情報を取得（最初のブロックの最初の項目）
    const firstItem = newsBlocks[0]?.querySelector('.lms-news-subO');
    const latestTitle = firstItem?.querySelector('a')?.textContent.trim() || '';
    const latestDate = firstItem?.textContent.replace(latestTitle, '').trim() || '';
    const latestKey = `${latestDate}::${latestTitle}`;

    // 件数カウント
    const totalItems = newsBlocks.reduce((sum, block) => {
        return sum + block.querySelectorAll('.lms-news-subO').length;
    }, 0);

    // 既読判定
    const READ_STORAGE_KEY = 'klpf-news-read';
    const savedRead = await chrome.storage.local.get({ [READ_STORAGE_KEY]: '' });
    const isRead = savedRead[READ_STORAGE_KEY] === latestKey;
    const displayCount = isRead ? 0 : totalItems;

    // ヘッダー
    const header = document.createElement('div');
    header.id = 'klpf-news-widget-header';

    const headerLabel = document.createElement('span');
    headerLabel.textContent = '📋 お知らせ / Topics ';

    const badge = document.createElement('span');
    badge.id = 'klpf-news-widget-badge';
    badge.textContent = displayCount;
    if (isRead) badge.classList.add('read');
    headerLabel.appendChild(badge);

    const markReadBtn = document.createElement('button');
    markReadBtn.id = 'klpf-news-mark-read';
    markReadBtn.textContent = isRead ? '既読済み ✓' : '既読にする';
    if (isRead) markReadBtn.classList.add('done');

    markReadBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); // ヘッダーの折りたたみを防止
        if (markReadBtn.classList.contains('done')) return;
        await chrome.storage.local.set({ [READ_STORAGE_KEY]: latestKey });
        badge.textContent = '0';
        badge.classList.add('read');
        markReadBtn.textContent = '既読済み ✓';
        markReadBtn.classList.add('done');
    });

    const toggle = document.createElement('span');
    toggle.id = 'klpf-news-widget-toggle';
    toggle.textContent = '▼';

    header.appendChild(headerLabel);
    header.appendChild(markReadBtn);
    header.appendChild(toggle);

    // ボディ
    const body = document.createElement('div');
    body.id = 'klpf-news-widget-body';

    // 元のブロックをウィジェットに移動
    newsBlocks.forEach((block, i) => {
        if (i > 0) {
            const divider = document.createElement('hr');
            divider.className = 'klpf-news-divider';
            body.appendChild(divider);
        }
        body.appendChild(block);
    });

    widget.appendChild(header);
    widget.appendChild(body);
    document.body.appendChild(widget);

    // --- 折りたたみトグル ---
    const storageKey = 'klpf-news-widget-collapsed';
    const savedState = localStorage.getItem(storageKey);
    if (savedState === 'true') {
        widget.classList.add('collapsed');
    }

    header.addEventListener('click', () => {
        widget.classList.toggle('collapsed');
        localStorage.setItem(storageKey, widget.classList.contains('collapsed'));
    });

    console.log('[KLPF] お知らせウィジェットを初期化しました。');
})();
