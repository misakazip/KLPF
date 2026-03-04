// Copyright (c) 2024-2025 SAYU
// This software is released under the MIT License, see LICENSE.

/**
 * @file 課題提出ページにドラッグ&ドロップによるファイル提出機能を追加するモジュール
 * @description
 * LMSの課題提出ページ全体へファイルをドラッグ&ドロップするだけで
 * ファイル入力欄にセットできる機能を追加する。
 * 複数ファイルの同時ドロップに対応し、不足する入力欄は自動で追加される。
 */
(() => {
    'use strict';

    const FEATURE_NAME = 'KLPF-DropSubmit';
    const MAX_FILE_SIZE_MB = 20;
    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
    const MAX_FILE_COUNT = 5;
    const DROP_ZONE_ID = 'klpf-drop-zone';
    const OVERLAY_ID = 'klpf-drag-overlay';

    const SEL = {
        FILE_INPUT: 'input.fileField.lms-file[type="file"]',
        FILE_TEXT: 'input.lms-file-text[type="text"]',
        FILE_ROW: 'div[id^="makeFile"]',
        ADD_BUTTON: '#addButton',
        CLEAR_BUTTON: 'input[type="button"][onclick^="delFile"]',
    };

    const STYLES = `
        #${DROP_ZONE_ID}{border:3px dashed #4a90d9;border-radius:12px;padding:32px 20px;margin:16px 0;text-align:center;background:#f0f6ff;transition:all .2s;cursor:pointer;position:relative}
        #${DROP_ZONE_ID} .drop-icon{font-size:48px;margin-bottom:8px;display:block}
        #${DROP_ZONE_ID} .drop-main-text{font-size:16px;font-weight:bold;color:#1e40af;margin-bottom:4px}
        #${DROP_ZONE_ID} .drop-sub-text{font-size:13px;color:#6b7280}
        #${DROP_ZONE_ID} .drop-file-list{margin-top:12px;text-align:left;font-size:13px;color:#374151}
        #${DROP_ZONE_ID} .drop-file-item{padding:4px 8px;margin:2px 0;background:#e5e7eb;border-radius:6px;display:inline-flex;align-items:center;gap:6px}
        #${DROP_ZONE_ID} .drop-file-item .remove-btn{cursor:pointer;color:#ef4444;font-weight:bold;font-size:14px;border:none;background:none;padding:0 2px;line-height:1}
        #${DROP_ZONE_ID} .drop-file-item .remove-btn:hover{color:#b91c1c}
        #${DROP_ZONE_ID} .drop-msg{font-size:13px;margin-top:8px}
        #${DROP_ZONE_ID} .drop-msg.error{color:#ef4444}
        #${DROP_ZONE_ID} .drop-msg.success{color:#16a34a;font-weight:bold}
        #${OVERLAY_ID}{display:none;position:fixed;inset:0;background:rgba(37,99,235,.12);z-index:99999;justify-content:center;align-items:center;flex-direction:column}
        #${OVERLAY_ID}.active{display:flex}
        #${OVERLAY_ID} *{pointer-events:none}
        #${OVERLAY_ID} .overlay-icon{font-size:64px;margin-bottom:12px}
        #${OVERLAY_ID} .overlay-text{font-size:22px;font-weight:bold;color:#1e40af;text-shadow:0 1px 4px rgba(255,255,255,.8)}
        #${OVERLAY_ID} .overlay-sub{font-size:14px;color:#3b82f6;margin-top:4px}
    `;

    // =========================================================================
    // ユーティリティ
    // =========================================================================

    /** 提出済みファイル数（「クリア」ボタンの数） */
    const getExistingCount = () => document.querySelectorAll(SEL.CLEAR_BUTTON).length;

    /** ファイル入力欄の一覧 */
    const getFileInputs = () => Array.from(document.querySelectorAll(SEL.FILE_INPUT));

    /** ファイルサイズの整形 */
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    /** HTMLエスケープ */
    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    /** 「ファイル追加」ボタンを押して入力欄を追加する */
    function addFileRow() {
        const btn = document.querySelector(SEL.ADD_BUTTON);
        if (!btn) return false;
        btn.click();
        return true;
    }

    /** 入力欄が指定数になるまで待機する */
    function waitForFileInput(expectedCount, timeout = 2000) {
        return new Promise(resolve => {
            if (getFileInputs().length >= expectedCount) return resolve(true);
            const start = Date.now();
            const id = setInterval(() => {
                if (getFileInputs().length >= expectedCount) { clearInterval(id); resolve(true); }
                else if (Date.now() - start > timeout) { clearInterval(id); resolve(false); }
            }, 50);
        });
    }

    /** ファイル入力欄にファイルをセットする */
    function setFileToInput(fileInput, file) {
        try {
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInput.files = dt.files;
            const row = fileInput.closest(SEL.FILE_ROW);
            const textInput = row?.querySelector(SEL.FILE_TEXT);
            if (textInput) textInput.value = file.name;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        } catch (e) {
            console.error(`[${FEATURE_NAME}] ファイル設定エラー:`, e);
            return false;
        }
    }

    // =========================================================================
    // メッセージ表示
    // =========================================================================

    /** ドロップゾーン内にメッセージを表示する */
    function showMessage(text, type) {
        const zone = document.getElementById(DROP_ZONE_ID);
        if (!zone) return;
        let el = zone.querySelector(`.drop-msg.${type}`);
        if (!el) {
            el = document.createElement('div');
            el.className = `drop-msg ${type}`;
            zone.appendChild(el);
        }
        el.textContent = text;
    }

    function clearMessages() {
        document.getElementById(DROP_ZONE_ID)
            ?.querySelectorAll('.drop-msg')
            .forEach(el => el.remove());
    }

    // =========================================================================
    // ファイル処理
    // =========================================================================

    /** @type {File[]} */
    let stagedFiles = [];

    /** ドロップまたは選択されたファイルを処理する */
    async function handleFiles(files) {
        clearMessages();
        const errors = [];
        const accepted = [];

        for (const file of files) {
            const total = getExistingCount() + stagedFiles.length + accepted.length;
            if (total >= MAX_FILE_COUNT) {
                errors.push(`ファイルは最大${MAX_FILE_COUNT}個まで。「${file.name}」は追加できません`);
            } else if (file.size > MAX_FILE_SIZE_BYTES) {
                errors.push(`「${file.name}」は${MAX_FILE_SIZE_MB}MBを超えています (${formatFileSize(file.size)})`);
            } else if (stagedFiles.some(f => f.name === file.name && f.size === file.size)) {
                errors.push(`「${file.name}」は既に追加されています`);
            } else {
                accepted.push(file);
            }
        }

        if (accepted.length > 0) {
            stagedFiles.push(...accepted);
            await applyFilesToInputs();
            renderFileList();
            const t = getExistingCount() + stagedFiles.length;
            showMessage(`${accepted.length}件のファイルをセットしました (${t}/${MAX_FILE_COUNT})`, 'success');
        }
        if (errors.length > 0) showMessage(errors.join('\n'), 'error');
    }

    /** stagedFiles をLMSの入力欄に反映する */
    async function applyFilesToInputs() {
        for (let i = 0; i < stagedFiles.length; i++) {
            let inputs = getFileInputs();
            if (inputs.length <= i) {
                addFileRow();
                if (!await waitForFileInput(i + 1)) {
                    console.error(`[${FEATURE_NAME}] ファイル入力欄の追加がタイムアウトしました`);
                    return;
                }
                inputs = getFileInputs();
            }
            setFileToInput(inputs[i], stagedFiles[i]);
        }
    }

    /** ファイルリスト表示を更新する */
    function renderFileList() {
        const listEl = document.getElementById('klpf-drop-file-list');
        if (!listEl) return;
        if (stagedFiles.length === 0) { listEl.innerHTML = ''; return; }

        listEl.innerHTML = stagedFiles.map((f, i) =>
            `<span class="drop-file-item">📎 ${escapeHtml(f.name)} (${formatFileSize(f.size)})<button class="remove-btn" data-index="${i}" title="削除">✕</button></span>`
        ).join('');

        listEl.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeFile(parseInt(btn.dataset.index, 10));
            });
        });
    }

    /** ファイルを削除して再適用する */
    async function removeFile(index) {
        if (index < 0 || index >= stagedFiles.length) return;
        stagedFiles.splice(index, 1);
        clearAllFileInputs();
        await applyFilesToInputs();
        renderFileList();
        clearMessages();
        if (stagedFiles.length > 0) {
            const t = getExistingCount() + stagedFiles.length;
            showMessage(`${stagedFiles.length}件のファイルがセットされています (${t}/${MAX_FILE_COUNT})`, 'success');
        }
    }

    /** すべてのファイル入力欄をクリアする */
    function clearAllFileInputs() {
        for (const input of getFileInputs()) {
            try { input.files = new DataTransfer().files; } catch { input.value = ''; }
            const textInput = input.closest(SEL.FILE_ROW)?.querySelector(SEL.FILE_TEXT);
            if (textInput) textInput.value = '';
        }
    }

    // =========================================================================
    // UI セットアップ
    // =========================================================================

    /** ドロップゾーン（インライン表示用）を作成する */
    function createDropZone() {
        if (document.getElementById(DROP_ZONE_ID)) return;
        const firstRow = getFileInputs()[0]?.closest(SEL.FILE_ROW);
        if (!firstRow?.parentElement) return;

        const existing = getExistingCount();
        const remaining = Math.max(0, MAX_FILE_COUNT - existing);
        const subText = existing > 0
            ? `または ここをクリックしてファイルを選択 ― 最大 ${MAX_FILE_COUNT}ファイル / ${MAX_FILE_SIZE_MB}MB (提出済み: ${existing}件、残り: ${remaining}件)`
            : `または ここをクリックしてファイルを選択 ― 最大 ${MAX_FILE_COUNT}ファイル / ${MAX_FILE_SIZE_MB}MB`;

        const zone = document.createElement('div');
        zone.id = DROP_ZONE_ID;
        zone.innerHTML = `<span class="drop-icon">📂</span><div class="drop-main-text">ページ全体にファイルをドラッグ&ドロップ</div><div class="drop-sub-text">${subText}</div><div class="drop-file-list" id="klpf-drop-file-list"></div>`;
        firstRow.parentElement.insertBefore(zone, firstRow);

        // クリックでファイル選択
        const hiddenInput = Object.assign(document.createElement('input'), { type: 'file', multiple: true, style: 'display:none', id: 'klpf-hidden-file-input' });
        zone.appendChild(hiddenInput);
        zone.addEventListener('click', (e) => { if (!e.target.classList.contains('remove-btn')) hiddenInput.click(); });
        hiddenInput.addEventListener('change', () => { if (hiddenInput.files.length) handleFiles(Array.from(hiddenInput.files)); hiddenInput.value = ''; });
    }

    /** ページ全体のD&Dイベントをセットアップする */
    function setupPageWideDragDrop() {
        const overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.innerHTML = `<span class="overlay-icon">📂</span><div class="overlay-text">ここにファイルをドロップして追加</div><div class="overlay-sub">最大 ${MAX_FILE_COUNT}ファイル / ${MAX_FILE_SIZE_MB}MB</div>`;
        document.body.appendChild(overlay);

        let dragCounter = 0;
        const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };

        document.addEventListener('dragenter', (e) => { prevent(e); if (++dragCounter === 1) overlay.classList.add('active'); }, true);
        document.addEventListener('dragleave', (e) => { prevent(e); if (--dragCounter <= 0) { dragCounter = 0; overlay.classList.remove('active'); } }, true);
        document.addEventListener('dragover', prevent, true);
        document.addEventListener('drop', (e) => {
            prevent(e);
            dragCounter = 0;
            overlay.classList.remove('active');
            const files = Array.from(e.dataTransfer.files);
            if (files.length) handleFiles(files);
        }, true);
    }

    // =========================================================================
    // メイン処理
    // =========================================================================

    function main() {
        if (getFileInputs().length === 0) {
            console.log(`[${FEATURE_NAME}] ファイル入力欄が見つからないため、処理をスキップします。`);
            return;
        }
        console.log(`[${FEATURE_NAME}] 課題提出ページを検出。ページ全体D&Dを有効化します。`);

        const style = document.createElement('style');
        style.id = 'klpf-dropsubmit-style';
        document.head.appendChild(style).textContent = STYLES;

        createDropZone();
        setupPageWideDragDrop();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main);
    else main();
})();
