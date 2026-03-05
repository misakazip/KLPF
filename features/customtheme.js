// Copyright (c) 2024-2025 SAYU
// This software is released under the MIT License, see LICENSE.

/**
 * @file LMS上に設定ページと同様のパーティクルエフェクトとカスタムカーソルを適用する機能。
 */

(function () {
    'use strict';

    const PARTICLE_COUNT = 50;
    const RAINBOW_COLORS = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#8B00FF'];

    // --- CSS を注入 ---
    const style = document.createElement('style');
    style.textContent = `
        /* パーティクルキャンバス */
        #klpf-particle-canvas {
            background-color: transparent;
            height: 100vh;
            left: 0;
            overflow: hidden;
            pointer-events: none;
            position: fixed;
            top: 0;
            width: 100vw;
            z-index: 0;
        }

        /* パーティクル */
        .klpf-powder-particle {
            animation-name: klpf-rise;
            animation-timing-function: linear;
            border-radius: 50%;
            bottom: -10px;
            height: 5px;
            opacity: 0;
            pointer-events: none;
            position: absolute;
            width: 5px;
        }

        @keyframes klpf-rise {
            0%   { opacity: 1; transform: translateY(0) translateX(0) scale(0.5); }
            50%  { opacity: 0.8; transform: translateY(-50vh) translateX(var(--drift-amount, 0px)) scale(1); }
            100% { opacity: 0; transform: translateY(-100vh) translateX(calc(var(--drift-amount, 0px) * 1.5)) scale(0.5); }
        }

        /* カスタムカーソル */
        #klpf-custom-cursor {
            animation: klpf-rainbow-glow 4s linear infinite;
            border-radius: 50%;
            height: 24px;
            left: 0;
            pointer-events: none;
            position: fixed;
            top: 0;
            transform: translate(-50%, -50%);
            transition: transform 0.07s ease-out, width 0.15s ease-out, height 0.15s ease-out;
            width: 24px;
            z-index: 100000;
        }

        #klpf-custom-cursor.cursor-active {
            transform: translate(-50%, -50%) scale(0.7);
        }

        #klpf-custom-cursor.cursor-interactive {
            height: 32px;
            width: 32px;
        }

        @keyframes klpf-rainbow-glow {
            0%      { background-color: hsla(0, 100%, 70%, 0.1);   box-shadow: 0 0 8px 2px hsla(0, 100%, 50%, 0.6),   0 0 15px 4px hsla(0, 100%, 50%, 0.4); }
            16.66%  { background-color: hsla(30, 100%, 70%, 0.1);  box-shadow: 0 0 8px 2px hsla(30, 100%, 50%, 0.6),  0 0 15px 4px hsla(30, 100%, 50%, 0.4); }
            33.33%  { background-color: hsla(60, 100%, 70%, 0.1);  box-shadow: 0 0 8px 2px hsla(60, 100%, 50%, 0.6),  0 0 15px 4px hsla(60, 100%, 50%, 0.4); }
            50%     { background-color: hsla(120, 100%, 70%, 0.1); box-shadow: 0 0 8px 2px hsla(120, 100%, 50%, 0.6), 0 0 15px 4px hsla(120, 100%, 50%, 0.4); }
            66.66%  { background-color: hsla(240, 100%, 70%, 0.1); box-shadow: 0 0 8px 2px hsla(240, 100%, 50%, 0.6), 0 0 15px 4px hsla(240, 100%, 50%, 0.4); }
            83.33%  { background-color: hsla(270, 100%, 70%, 0.1); box-shadow: 0 0 8px 2px hsla(270, 100%, 50%, 0.6), 0 0 15px 4px hsla(270, 100%, 50%, 0.4); }
            100%    { background-color: hsla(360, 100%, 70%, 0.1); box-shadow: 0 0 8px 2px hsla(360, 100%, 50%, 0.6), 0 0 15px 4px hsla(360, 100%, 50%, 0.4); }
        }

        /* LMS上のカーソルをnoneに (カスタムカーソル適用時) */
        body.klpf-custom-cursor-active,
        body.klpf-custom-cursor-active * {
            cursor: none !important;
        }
    `;
    document.head.appendChild(style);

    // --- パーティクルキャンバス ---
    const canvas = document.createElement('div');
    canvas.id = 'klpf-particle-canvas';
    document.body.appendChild(canvas);

    function getRandomColor() {
        return RAINBOW_COLORS[Math.floor(Math.random() * RAINBOW_COLORS.length)];
    }

    function createParticle() {
        const particle = document.createElement('div');
        particle.classList.add('klpf-powder-particle');
        particle.style.left = `${Math.floor(Math.random() * window.innerWidth)}px`;
        particle.style.backgroundColor = getRandomColor();
        particle.style.animationDuration = `${Math.random() * 5 + 7}s`;
        particle.style.setProperty('--drift-amount', `${Math.random() * 30 + 10}px`);
        particle.style.animationDelay = `${Math.random() * 5}s`;
        canvas.appendChild(particle);
        particle.addEventListener('animationend', function () {
            this.remove();
            createParticle();
        });
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        createParticle();
    }

    // --- カスタムカーソル ---
    const cursor = document.createElement('div');
    cursor.id = 'klpf-custom-cursor';
    document.body.appendChild(cursor);
    document.body.classList.add('klpf-custom-cursor-active');

    document.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
    });
    document.addEventListener('mousedown', () => cursor.classList.add('cursor-active'));
    document.addEventListener('mouseup', () => cursor.classList.remove('cursor-active'));

    // インタラクティブ要素でカーソルを大きくする
    const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, [role="button"], [onclick], .clickable';

    // 既存の要素にリスナーを付与
    function attachCursorListeners(root) {
        root.querySelectorAll(INTERACTIVE_SELECTOR).forEach(el => {
            if (el.dataset.klpfCursor) return; // 重複防止
            el.dataset.klpfCursor = '1';
            el.addEventListener('mouseenter', () => cursor.classList.add('cursor-interactive'));
            el.addEventListener('mouseleave', () => cursor.classList.remove('cursor-interactive'));
        });
    }

    attachCursorListeners(document);

    // 動的に追加される要素にも対応
    new MutationObserver(() => attachCursorListeners(document)).observe(document.body, {
        childList: true,
        subtree: true,
    });

    console.log('[KLPF] カスタムテーマ（パーティクル + カスタムカーソル）を適用しました。');
})();
