// Copyright (c) 2024-2025 SAYU
// This software is released under the MIT License, see LICENSE.

/**
 * @file 本日の授業実施日ハイライト機能
 * @description
 * LMSの教材一覧ページで、授業実施日が今日の日付と一致するフォルダ行を
 * 視覚的にハイライト表示する。
 * td.jyugyeditCell.checkStBoldJyugyoDy の日付テキストを今日と比較し、
 * 一致する tr.accordionHeader を目立つ枠とバッジで囲む。
 */
(() => {
    'use strict';

    const FEATURE_NAME = 'KLPF';

    const SEL = {
        JYUGYO_DATE_CELL: 'td.jyugyeditCell.checkStBoldJyugyoDy',
        ACCORDION_HEADER: 'tr.accordionHeader',
    };

    const STYLE_ID = 'klpf-today-highlight-style';
    const HIGHLIGHT_CLASS = 'klpf-today-highlight';

    const STYLES = `
        tr.accordionHeader.${HIGHLIGHT_CLASS} {
            outline: 3px solid #2563eb !important;
            outline-offset: -2px;
            background: linear-gradient(90deg, rgba(37,99,235,0.08) 0%, rgba(37,99,235,0.03) 100%) !important;
            border-radius: 4px;
            position: relative;
        }
        tr.accordionHeader.${HIGHLIGHT_CLASS} > td:first-child::before {
            content: '▶ 本日';
            display: inline-block;
            background: #2563eb;
            color: #fff;
            font-size: 11px;
            font-weight: bold;
            padding: 1px 8px;
            border-radius: 3px;
            margin-right: 6px;
            vertical-align: middle;
        }
    `;

    /**
     * 今日の日付を YYYY/MM/DD 形式で取得する。
     * @returns {string}
     */
    function getTodayString() {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        return yyyy + '/' + mm + '/' + dd;
    }

    /**
     * スタイルシートを一度だけ注入する。
     */
    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = STYLES;
        document.head.appendChild(style);
    }

    /**
     * 授業実施日が今日のフォルダ行をハイライトする。
     */
    function highlightTodayRows() {
        const todayStr = getTodayString();
        const dateCells = document.querySelectorAll(SEL.JYUGYO_DATE_CELL);

        dateCells.forEach(cell => {
            const dateText = cell.textContent.trim();
            if (dateText === todayStr) {
                const row = cell.closest(SEL.ACCORDION_HEADER);
                if (row && !row.classList.contains(HIGHLIGHT_CLASS)) {
                    row.classList.add(HIGHLIGHT_CLASS);
                }
            }
        });
    }

    /**
     * DOM変更を監視し、動的に追加される行にもハイライトを適用する。
     */
    function startObserver() {
        const observer = new MutationObserver(() => {
            highlightTodayRows();
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    /**
     * 初期化
     */
    function initialize() {
        try {
            injectStyles();
            highlightTodayRows();
            startObserver();
            console.info(`[${FEATURE_NAME}] 本日の授業ハイライト機能が初期化されました`);
        } catch (error) {
            console.error(`[${FEATURE_NAME}] 初期化中にエラーが発生しました:`, error);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();
