// ==UserScript==
// @name         KLPF Subject Filter
// @namespace    https://github.com/SAYUTIM/KLPF
// @version      1.0.0
// @description  工学院大学 LMS 講義一覧の履修中科目フィルタリング＆現在の講義ハイライト (KLPF ユーザースクリプト版)
// @author       SAYU
// @license      MIT
// @match        https://study.ns.kogakuin.ac.jp/lms/homeHoml/doIndex;*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // --- 定数 ---
    const SUBJECT_HIGHLIGHT_CLASS = 'klpf-subject-highlight';
    const STORAGE_KEY = 'klpf-course-filter-settings';

    const TIME_SCHEDULE_NORMAL = [
        { start: '08:30', end: '10:00', label: '1限' },
        { start: '10:10', end: '11:40', label: '2限' },
        { start: '11:41', end: '12:29', label: '昼休み' },
        { start: '12:30', end: '14:00', label: '3限' },
        { start: '14:10', end: '15:40', label: '4限' },
        { start: '15:50', end: '17:20', label: '5限' },
        { start: '17:30', end: '19:00', label: '6限' }
    ];

    // --- ユーティリティ ---
    function safeQuerySelector(selector, root = document) {
        try { return root.querySelector(selector); }
        catch { return null; }
    }

    function safeQuerySelectorAll(selector, root = document) {
        try { return Array.from(root.querySelectorAll(selector)); }
        catch { return []; }
    }

    // --- ストレージ (GM API / localStorage フォールバック) ---
    function loadSettings() {
        try {
            const raw = typeof GM_getValue === 'function'
                ? GM_getValue(STORAGE_KEY, null)
                : localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }

    function saveSettings(form) {
        const settings = {
            isAutoActive: form.querySelector('#autoFilterCheckbox')?.checked || false,
            yobi:  form.querySelector('select[name="yobi"]')?.value  || 'all',
            jigen: form.querySelector('select[name="jigen"]')?.value || 'all',
            kougiName: form.querySelector('input[name="kougiName"]')?.value.trim() || '',
            kyoinName: form.querySelector('input[name="kyoinName"]')?.value.trim() || '',
            checkKiList: safeQuerySelectorAll('input[name="checkKiList"]:checked', form).map(cb => cb.value)
        };
        const json = JSON.stringify(settings);
        if (typeof GM_setValue === 'function') {
            GM_setValue(STORAGE_KEY, json);
        } else {
            localStorage.setItem(STORAGE_KEY, json);
        }
    }

    function clearSettings() {
        if (typeof GM_deleteValue === 'function') {
            GM_deleteValue(STORAGE_KEY);
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    }

    // --- カード情報抽出 ---
    function extractCardInfo(card) {
        const infoText = (safeQuerySelector('.courseCardInfo', card)?.textContent || '').replace(/\s+/g, ' ');
        const match = infoText.match(/(\d+)限(.*)/);
        const periodCode = match ? ('0' + match[1]).slice(-2) : '';
        const semesterText = match ? match[2].trim() : infoText.trim();
        const dayText = card.closest('.lms-daybox')?.querySelector('.lms-category-title h3')?.textContent.trim();

        return {
            courseName: safeQuerySelector('.lms-cardname', card)?.textContent.trim() || '',
            instructor: safeQuerySelector('.lms-carduser', card)?.textContent.trim() || '',
            dayCode: { '月曜日':'1','火曜日':'2','水曜日':'3','木曜日':'4','金曜日':'5','土曜日':'6','日曜日':'7','その他':'Z' }[dayText] || '',
            periodCode,
            semesterCode: { '通年':'01','前期':'02','後期':'03','1Q':'04','2Q':'05','3Q':'06','4Q':'07','集中・特週':'08','自己学習':'09','その他':'10','講義':'11' }[semesterText.split(' ')[0]] || '',
            semesterText
        };
    }

    // --- フィルタリング ---
    function toggleSearchButtonVisibility(isAutoActive) {
        const btn = safeQuerySelector('button[onclick="submitSearch();"]');
        if (btn) btn.style.display = isAutoActive ? 'none' : '';
    }

    function applyClientSideFilter(form) {
        const settings = {
            isAutoActive: form.querySelector('#autoFilterCheckbox')?.checked || false,
            yobi:  form.querySelector('select[name="yobi"]').value,
            jigen: form.querySelector('select[name="jigen"]').value,
            kougiName: form.querySelector('input[name="kougiName"]').value.trim().toLowerCase(),
            kyoinName: form.querySelector('input[name="kyoinName"]').value.trim().toLowerCase(),
            checkKiList: safeQuerySelectorAll('input[name="checkKiList"]:checked', form).map(cb => cb.value)
        };

        toggleSearchButtonVisibility(settings.isAutoActive);

        const nowQ = (month => (month >= 4 && month <= 5) ? 1 : (month >= 6 && month <= 7) ? 2 : (month >= 8 && month <= 10) ? 3 : 4)(new Date().getMonth() + 1);

        safeQuerySelectorAll('.lms-card').forEach(card => {
            const info = extractCardInfo(card);
            let isVisible = true;

            if (settings.isAutoActive) {
                const termMatch = [
                    ['1Q','前期','通年'],
                    ['2Q','前期','通年'],
                    ['3Q','後期','通年'],
                    ['4Q','後期','通年']
                ];
                const otherTerms = ['その他','集中・特週','自己学習','講義'];
                if (!otherTerms.some(t => info.semesterText.includes(t)) &&
                    !termMatch[nowQ - 1].some(t => info.semesterText.includes(t))) {
                    isVisible = false;
                }
            } else if (settings.checkKiList.length > 0) {
                if (!settings.checkKiList.includes(info.semesterCode)) isVisible = false;
            }

            if (isVisible) {
                if (settings.yobi  !== 'all' && settings.yobi  !== info.dayCode)    isVisible = false;
                if (settings.jigen !== 'all' && settings.jigen !== info.periodCode)  isVisible = false;
                if (settings.kougiName && !info.courseName.toLowerCase().includes(settings.kougiName)) isVisible = false;
                if (settings.kyoinName && !info.instructor.toLowerCase().includes(settings.kyoinName)) isVisible = false;
            }
            card.style.display = isVisible ? '' : 'none';
        });

        safeQuerySelectorAll('.lms-daybox').forEach(dayBox => {
            const visible = safeQuerySelectorAll('.lms-card', dayBox).filter(c => c.style.display !== 'none');
            dayBox.style.display = visible.length > 0 ? '' : 'none';
        });
    }

    // --- ハイライト ---
    function highlightCurrentClass() {
        safeQuerySelectorAll(`.${SUBJECT_HIGHLIGHT_CLASS}`).forEach(el => el.classList.remove(SUBJECT_HIGHLIGHT_CLASS));

        const now = new Date();
        const dayOfWeek = now.getDay();
        const currentTime = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
        const currentDayCode = { 0:'7',1:'1',2:'2',3:'3',4:'4',5:'5',6:'6' }[dayOfWeek];

        const currentPeriod = TIME_SCHEDULE_NORMAL.find(p => currentTime >= p.start && currentTime <= p.end);
        if (!currentPeriod || !currentPeriod.label.includes('限')) return;

        const periodCode = ('0' + currentPeriod.label.replace('限', '')).slice(-2);

        safeQuerySelectorAll('.lms-card').forEach(card => {
            if (card.style.display === 'none') return;
            const info = extractCardInfo(card);
            if (info.dayCode === currentDayCode && info.periodCode === periodCode) {
                card.classList.add(SUBJECT_HIGHLIGHT_CLASS);
            }
        });
    }

    // --- UI ---
    function addAutoFilterCheckbox(targetCell) {
        if (document.getElementById('autoFilterCheckbox')) return;
        targetCell.insertAdjacentHTML('afterbegin', `
            <label class="lms-form-checkbox-label" style="font-weight: bold; color: #d9534f; padding-right: 10px;">
                <span class="lms-checkbox"><input type="checkbox" id="autoFilterCheckbox"><label for="autoFilterCheckbox"><span class="fj-icon fj-icon-check"></span></label></span>自動
            </label>
        `);
    }

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .lms-weekly-area { visibility: hidden; }
            .${SUBJECT_HIGHLIGHT_CLASS} {
                border: 2px solid #d9534f !important;
                box-shadow: 0 0 10px rgba(217, 83, 79, 0.5);
            }
        `;
        document.head.appendChild(style);
    }

    function setupEventListeners(form) {
        form.addEventListener('input', () => {
            const autoCheckbox = form.querySelector('#autoFilterCheckbox');
            if (autoCheckbox) {
                safeQuerySelectorAll('input[name="checkKiList"]', form).forEach(cb => cb.disabled = autoCheckbox.checked);
            }
            applyClientSideFilter(form);
            saveSettings(form);
        });

        const clearButton = form.querySelector('button[onclick^="clearDate"]');
        if (clearButton) {
            clearButton.addEventListener('click', (e) => {
                e.preventDefault();
                clearSettings();
                form.reset();
                safeQuerySelectorAll('input[name="checkKiList"]', form).forEach(cb => cb.disabled = false);
                applyClientSideFilter(form);
            });
        }
    }

    // --- メイン ---
    function main() {
        const form = safeQuerySelector('#homeHomlForm');
        const weeklyArea = safeQuerySelector('.lms-weekly-area');
        const termCell = safeQuerySelectorAll('th', form).find(th => th.textContent.trim() === '期')?.nextElementSibling;

        if (!form || !weeklyArea || !termCell) {
            if (weeklyArea) weeklyArea.style.visibility = 'visible';
            return;
        }

        injectStyles();
        addAutoFilterCheckbox(termCell);

        const saved = loadSettings();
        if (Object.keys(saved).length > 0) {
            const autoCheckbox = form.querySelector('#autoFilterCheckbox');
            if (autoCheckbox) autoCheckbox.checked = saved.isAutoActive || false;
            form.querySelector('select[name="yobi"]').value  = saved.yobi  || 'all';
            form.querySelector('select[name="jigen"]').value = saved.jigen || 'all';
            form.querySelector('input[name="kougiName"]').value = saved.kougiName || '';
            form.querySelector('input[name="kyoinName"]').value = saved.kyoinName || '';
            safeQuerySelectorAll('input[name="checkKiList"]', form).forEach(cb => {
                cb.checked = saved.checkKiList ? saved.checkKiList.includes(cb.value) : false;
                if (autoCheckbox) cb.disabled = autoCheckbox.checked;
            });
        }

        applyClientSideFilter(form);
        setupEventListeners(form);
        highlightCurrentClass();
        setInterval(highlightCurrentClass, 60000);

        weeklyArea.style.visibility = 'visible';
        console.log('[KLPF] 講義フィルター機能を初期化しました。');
    }

    const safeRun = () => {
        try { main(); }
        catch (error) {
            console.error('[KLPF] 講義フィルター機能の実行中にエラーが発生しました。', error);
            const weeklyArea = safeQuerySelector('.lms-weekly-area');
            if (weeklyArea) weeklyArea.style.visibility = 'visible';
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', safeRun);
    } else {
        safeRun();
    }

})();
