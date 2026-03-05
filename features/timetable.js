// Copyright (c) 2024-2025 SAYU
// This software is released under the MIT License, see LICENSE.

/**
 * @file KUPORTの時間割データをスクレイピングし、LMS上にモーダルで表示する機能。
 * - KUPORTで「学生時間割表」ページを開くと自動的にデータをchrome.storage.localに保存
 * - LMSヘッダーに「時間割」ボタンを追加し、クリックでモーダル表示
 * - 今日の曜日列・現在の時限をハイライト
 */

(async function () {
    'use strict';

    const KUPORT_HOST = 'ku-port.sc.kogakuin.ac.jp';
    const LMS_HOST = 'study.ns.kogakuin.ac.jp';
    const STORAGE_KEY = 'timetableData';

    const PERIOD_TIMES = [
        { period: 1, time: '08:30〜10:00', startMin: 510, endMin: 600 },
        { period: 2, time: '10:10〜11:40', startMin: 610, endMin: 700 },
        { period: 3, time: '12:30〜14:00', startMin: 750, endMin: 840 },
        { period: 4, time: '14:10〜15:40', startMin: 850, endMin: 940 },
        { period: 5, time: '15:50〜17:20', startMin: 950, endMin: 1040 },
        { period: 6, time: '17:30〜19:00', startMin: 1050, endMin: 1140 },
        { period: 7, time: '19:10〜20:40', startMin: 1150, endMin: 1240 },
    ];

    if (location.hostname === KUPORT_HOST) {
        initScraper();
    } else if (location.hostname === LMS_HOST) {
        await initDisplay();
    }

    // ================================================================
    // KUPORT: 時間割スクレイピング
    // ================================================================

    function initScraper() {
        let lastSavedHash = '';

        function tryScrapAndSave() {
            const table = document.querySelector('table.classTable');
            if (!table) return;

            const data = scrapeTimetable(table);
            if (!data || data.schedule.length === 0) return;

            const hash = JSON.stringify(data.schedule);
            if (hash === lastSavedHash) return;
            lastSavedHash = hash;

            chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
                console.log('[KLPF] 時間割データを保存しました。');
                showSaveNotification();
            });
        }

        // PrimeFacesのAJAX更新でテーブルが動的に挿入される場合に対応
        const observer = new MutationObserver(() => tryScrapAndSave());
        observer.observe(document.documentElement, { childList: true, subtree: true });
        tryScrapAndSave();
    }

    /**
     * table.classTable から時間割データを構造化してパースする。
     * @param {HTMLTableElement} table
     * @returns {object|null}
     */
    function scrapeTimetable(table) {
        const fieldset = table.closest('.ui-fieldset-content') || table.parentElement;

        // 学期・合計単位
        let semester = '';
        let totalCredits = '';
        const alignRight = fieldset?.querySelector('.alignRight');
        if (alignRight) {
            const m = alignRight.textContent.trim().match(/(.+?)合計単位\s*([\d.]+)/);
            if (m) { semester = m[1].trim(); totalCredits = m[2]; }
        }

        // 各時限・各曜日のデータをパース
        const schedule = [];
        for (const row of table.querySelectorAll('tbody > tr')) {
            if (row.querySelector('.colLunch')) continue;

            const periodCell = row.querySelector('.colJigen');
            if (!periodCell) continue;
            const period = periodCell.textContent.trim();
            if (!period) continue;

            const classes = [];
            for (const cell of row.querySelectorAll('.colYobi')) {
                const info = cell.querySelector('.jugyo-info');
                if (!info || info.classList.contains('noClass')) {
                    classes.push(null);
                    continue;
                }
                classes.push(parseClassCell(info));
            }
            schedule.push({ period: parseInt(period), classes });
        }

        // 時間情報
        const timeInfo = [];
        for (const dd of (fieldset?.querySelectorAll('.jigenArea') || [])) {
            timeInfo.push(dd.textContent.trim());
        }

        return { semester, totalCredits, schedule, timeInfo, lastUpdated: new Date().toISOString() };
    }

    /**
     * 授業セル (.jugyo-info) から各情報をパースする。
     */
    function parseClassCell(info) {
        const name = info.querySelector('.fontB')?.textContent.trim() || '';
        let teacher = '', room = '', code = '', credits = '', sign = '';
        let foundName = false;

        for (const child of info.querySelectorAll(':scope > div')) {
            if (child.classList.contains('fontB')) { foundName = true; continue; }
            if (!foundName) continue;
            if (child.classList.contains('taniSu')) { credits = child.textContent.trim().replace('単位', ''); continue; }
            if (child.classList.contains('sign')) { sign = child.textContent.trim(); continue; }
            if (child.querySelector('.noTextIconLine')) continue;

            const spans = child.querySelectorAll('span');
            if (spans.length > 0) {
                room = Array.from(spans).map(s => s.textContent.trim()).filter(Boolean).join('／');
                continue;
            }
            const text = child.textContent.trim();
            if (/^[A-Z]\d/.test(text)) { code = text; continue; }
            if (!teacher && text) teacher = text;
        }

        return { name, teacher, room, code, credits, sign };
    }

    /** KUPORT上でデータ保存完了の通知を表示する */
    function showSaveNotification() {
        if (!document.getElementById('klpf-tt-notify-style')) {
            const s = document.createElement('style');
            s.id = 'klpf-tt-notify-style';
            s.textContent = `
                @keyframes klpf-tt-fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
                @keyframes klpf-tt-fadeOut { from { opacity:1; transform:translateY(0); } to { opacity:0; transform:translateY(10px); } }
            `;
            document.head.appendChild(s);
        }

        const n = document.createElement('div');
        n.textContent = '✓ KLPFが時間割データを保存しました';
        n.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#1a73e8;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.15);animation:klpf-tt-fadeIn .3s ease;font-family:sans-serif;';
        document.body.appendChild(n);

        setTimeout(() => {
            n.style.animation = 'klpf-tt-fadeOut .3s ease forwards';
            setTimeout(() => n.remove(), 300);
        }, 3000);
    }

    // ================================================================
    // LMS: 時間割ボタン・モーダル表示
    // ================================================================

    async function initDisplay() {
        const header = await waitForElement('#lms-header-title-text');
        if (!header) return;

        injectStyles();

        const btn = document.createElement('button');
        btn.id = 'klpf-timetable-btn';
        btn.textContent = '📅 時間割';
        btn.title = 'KUPORTの時間割を表示';
        btn.addEventListener('click', openModal);

        // ヘッダーリンクコンテナが存在すればその中に、なければ新規ラッパーを作成
        const linksContainer = document.querySelector('#klpf-header-links');
        if (linksContainer) {
            linksContainer.appendChild(btn);
        } else {
            header.style.display = 'inline-flex';
            header.style.alignItems = 'center';
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:inline-flex;align-items:center;margin-left:16px;';
            wrap.appendChild(btn);
            header.appendChild(wrap);
        }

        console.log('[KLPF] 時間割表示機能を初期化しました。');
    }

    /** モーダルを開く */
    async function openModal() {
        document.getElementById('klpf-timetable-overlay')?.remove();

        const result = await chrome.storage.local.get(STORAGE_KEY);
        const data = result[STORAGE_KEY];

        const overlay = document.createElement('div');
        overlay.id = 'klpf-timetable-overlay';
        overlay.innerHTML = data ? buildTimetableHTML(data) : buildEmptyStateHTML();
        document.body.appendChild(overlay);

        // 閉じるイベント
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        const escHandler = (e) => {
            if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); }
        };
        document.addEventListener('keydown', escHandler);
        overlay.querySelector('#klpf-tt-close')?.addEventListener('click', () => overlay.remove());
    }

    /** データ未取得時の空状態HTML */
    function buildEmptyStateHTML() {
        return `
            <div class="klpf-tt-modal">
                <div class="klpf-tt-header">
                    <span>📅 時間割</span>
                    <button id="klpf-tt-close" class="klpf-tt-close-btn">✕</button>
                </div>
                <div class="klpf-tt-empty">
                    <p style="font-size:48px;margin:0;">📋</p>
                    <p style="font-size:16px;font-weight:600;margin:8px 0 4px;">時間割データがありません</p>
                    <p style="font-size:13px;color:#666;margin:0 0 16px;">KUPORTの「授業・時間割」→「学生時間割表」を<br>開くと自動的にデータが保存されます。</p>
                    <a href="https://ku-port.sc.kogakuin.ac.jp/" target="_blank" rel="noopener noreferrer" class="klpf-tt-kuport-btn">KUPORTを開く</a>
                </div>
            </div>`;
    }

    /** 時間割テーブルHTML を構築する */
    function buildTimetableHTML(data) {
        const days = ['月', '火', '水', '木', '金', '土'];
        const todayIdx = getTodayDayIndex();
        const currentPeriod = getCurrentPeriod();

        const updated = data.lastUpdated
            ? new Date(data.lastUpdated).toLocaleString('ja-JP', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit',
            })
            : '不明';

        // テーブルヘッダー
        let headerRow = '<tr><th class="klpf-tt-th-period">時限</th>';
        days.forEach((d, i) => {
            const cls = i === todayIdx ? ' klpf-tt-today-header' : '';
            headerRow += `<th class="klpf-tt-th-day${cls}">${d}</th>`;
        });
        headerRow += '</tr>';

        // テーブルボディ
        let bodyRows = '';
        for (const row of data.schedule) {
            const isCurrent = row.period === currentPeriod;
            const periodInfo = PERIOD_TIMES.find(p => p.period === row.period);
            const timeLabel = periodInfo ? periodInfo.time : '';

            bodyRows += '<tr>';
            bodyRows += `<td class="klpf-tt-td-period${isCurrent ? ' klpf-tt-current-period' : ''}" title="${timeLabel}">${row.period}<div class="klpf-tt-period-time">${timeLabel}</div></td>`;

            row.classes.forEach((cls, dayIdx) => {
                const isToday = dayIdx === todayIdx;
                const isNow = isToday && isCurrent;

                let cellCls = 'klpf-tt-td';
                if (isToday) cellCls += ' klpf-tt-today-col';
                if (isCurrent) cellCls += ' klpf-tt-current-row';
                if (isNow && cls) cellCls += ' klpf-tt-now';

                if (!cls) {
                    bodyRows += `<td class="${cellCls} klpf-tt-td-empty"></td>`;
                } else {
                    bodyRows += `<td class="${cellCls} klpf-tt-td-class">`;
                    bodyRows += `<div class="klpf-tt-class-name">${esc(cls.name)}</div>`;
                    bodyRows += `<div class="klpf-tt-class-teacher">${esc(cls.teacher)}</div>`;
                    if (cls.room) bodyRows += `<div class="klpf-tt-class-room">📍 ${esc(cls.room)}</div>`;
                    if (cls.credits) bodyRows += `<div class="klpf-tt-class-credits">${esc(cls.credits)}単位</div>`;
                    bodyRows += '</td>';
                }
            });
            bodyRows += '</tr>';
        }

        return `
            <div class="klpf-tt-modal">
                <div class="klpf-tt-header">
                    <span>📅 時間割</span>
                    <button id="klpf-tt-close" class="klpf-tt-close-btn">✕</button>
                </div>
                <div class="klpf-tt-info-bar">
                    <span class="klpf-tt-semester">${esc(data.semester)}</span>
                    <span class="klpf-tt-credits-badge">合計 ${esc(data.totalCredits)} 単位</span>
                    <span class="klpf-tt-updated">最終更新: ${updated}</span>
                </div>
                <div class="klpf-tt-table-wrap">
                    <table class="klpf-tt-table">
                        <thead>${headerRow}</thead>
                        <tbody>${bodyRows}</tbody>
                    </table>
                </div>
                <div class="klpf-tt-footer">
                    <a href="https://ku-port.sc.kogakuin.ac.jp/" target="_blank" rel="noopener noreferrer" class="klpf-tt-kuport-btn">🔄 KUPORTで更新</a>
                </div>
            </div>`;
    }

    // ================================================================
    // ユーティリティ
    // ================================================================

    /** 今日の曜日インデックス (月=0 … 土=5, 日=-1) を返す */
    function getTodayDayIndex() {
        const day = new Date().getDay();
        return day === 0 ? -1 : day - 1;
    }

    /** 現在の時限番号 (1-7) を返す。授業時間外は -1 */
    function getCurrentPeriod() {
        const now = new Date();
        const t = now.getHours() * 60 + now.getMinutes();
        for (const p of PERIOD_TIMES) {
            if (t >= p.startMin && t <= p.endMin) return p.period;
        }
        return -1;
    }

    /** HTMLエスケープ */
    function esc(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    /** スタイルシートを注入 */
    function injectStyles() {
        if (document.getElementById('klpf-timetable-style')) return;
        const style = document.createElement('style');
        style.id = 'klpf-timetable-style';
        style.textContent = `

        /* ====== ヘッダーボタン ====== */
        #klpf-timetable-btn {
            color: #1a73e8;
            font-size: 13px;
            font-weight: 500;
            padding: 4px 10px;
            border-radius: 4px;
            background: rgba(26, 115, 232, 0.08);
            border: none;
            cursor: pointer;
            white-space: nowrap;
            font-family: inherit;
            transition: background .2s;
        }
        #klpf-timetable-btn:hover {
            background: rgba(26, 115, 232, 0.18);
        }

        /* ====== オーバーレイ ====== */
        #klpf-timetable-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: klpf-tt-overlayIn .2s ease;
        }
        @keyframes klpf-tt-overlayIn {
            from { opacity: 0; }
            to   { opacity: 1; }
        }

        /* ====== モーダル ====== */
        .klpf-tt-modal {
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 8px 40px rgba(0, 0, 0, 0.22);
            max-width: 960px;
            width: 95vw;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            animation: klpf-tt-modalIn .25s ease;
        }
        @keyframes klpf-tt-modalIn {
            from { opacity: 0; transform: translateY(16px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ヘッダー */
        .klpf-tt-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 20px;
            background: linear-gradient(135deg, #1a73e8, #0d5bbd);
            color: #fff;
            font-size: 16px;
            font-weight: 600;
            flex-shrink: 0;
        }
        .klpf-tt-close-btn {
            background: rgba(255,255,255,0.15);
            border: none;
            color: #fff;
            font-size: 16px;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background .2s;
        }
        .klpf-tt-close-btn:hover {
            background: rgba(255,255,255,0.3);
        }

        /* 情報バー */
        .klpf-tt-info-bar {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #e8e8e8;
            font-size: 13px;
            flex-wrap: wrap;
            flex-shrink: 0;
        }
        .klpf-tt-semester {
            font-weight: 600;
            color: #333;
        }
        .klpf-tt-credits-badge {
            background: #1a73e8;
            color: #fff;
            padding: 2px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
        }
        .klpf-tt-updated {
            color: #888;
            font-size: 11px;
            margin-left: auto;
        }

        /* テーブルラッパー */
        .klpf-tt-table-wrap {
            overflow: auto;
            flex: 1 1 auto;
            min-height: 0;
        }

        /* テーブル */
        .klpf-tt-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            table-layout: fixed;
        }
        .klpf-tt-table th,
        .klpf-tt-table td {
            border: 1px solid #e0e0e0;
            padding: 6px 4px;
            text-align: center;
            vertical-align: top;
        }

        /* ヘッダーセル */
        .klpf-tt-th-period {
            width: 64px;
            background: #f0f0f0;
            font-weight: 600;
            color: #555;
        }
        .klpf-tt-th-day {
            background: #f0f0f0;
            font-weight: 600;
            color: #555;
        }
        .klpf-tt-today-header {
            background: #1a73e8 !important;
            color: #fff !important;
        }

        /* 時限セル */
        .klpf-tt-td-period {
            background: #fafafa;
            font-weight: 700;
            font-size: 14px;
            color: #555;
            width: 64px;
        }
        .klpf-tt-period-time {
            font-size: 9px;
            font-weight: 400;
            color: #999;
            margin-top: 2px;
        }
        .klpf-tt-current-period {
            background: #1a73e8 !important;
            color: #fff !important;
        }
        .klpf-tt-current-period .klpf-tt-period-time {
            color: rgba(255,255,255,0.75) !important;
        }

        /* 曜日セル */
        .klpf-tt-td-empty {
            background: #fdfdfd;
        }
        .klpf-tt-td-class {
            background: #fff;
            text-align: left;
            padding: 6px 6px;
        }

        /* 今日列 */
        .klpf-tt-today-col {
            background-color: rgba(26, 115, 232, 0.04) !important;
        }

        /* 現在の時限行 */
        .klpf-tt-current-row {
            /* 薄い行背景 */
        }

        /* 今の授業セル (今日 + 現在の時限) */
        .klpf-tt-now {
            background: rgba(26, 115, 232, 0.10) !important;
            box-shadow: inset 0 0 0 2px #1a73e8;
        }

        /* 授業情報 */
        .klpf-tt-class-name {
            font-weight: 600;
            font-size: 11px;
            color: #222;
            line-height: 1.35;
            margin-bottom: 3px;
            word-break: break-all;
        }
        .klpf-tt-class-teacher {
            font-size: 10px;
            color: #555;
            margin-bottom: 1px;
        }
        .klpf-tt-class-room {
            font-size: 10px;
            color: #777;
            margin-bottom: 1px;
        }
        .klpf-tt-class-credits {
            font-size: 9px;
            color: #999;
        }

        /* フッター */
        .klpf-tt-footer {
            padding: 10px 20px;
            border-top: 1px solid #e8e8e8;
            background: #f8f9fa;
            text-align: center;
            flex-shrink: 0;
        }
        .klpf-tt-kuport-btn {
            display: inline-block;
            color: #1a73e8;
            text-decoration: none;
            font-size: 13px;
            font-weight: 500;
            padding: 6px 18px;
            border-radius: 6px;
            background: rgba(26, 115, 232, 0.08);
            transition: background .2s;
        }
        .klpf-tt-kuport-btn:hover {
            background: rgba(26, 115, 232, 0.18);
            text-decoration: none;
        }

        /* 空状態 */
        .klpf-tt-empty {
            padding: 48px 20px;
            text-align: center;
        }
        `;
        document.head.appendChild(style);
    }
})();
