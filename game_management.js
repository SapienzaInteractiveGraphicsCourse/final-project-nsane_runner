import './pause.css';
import pauseHtml from './pause.html?raw';
import gameOverHtml from './gameover.html?raw';
import { pauseAllTweens, resumeAllTweens, stopAllTweens } from './tween_registry.js';
import {
    startMainTheme, toggleMainTheme, isMusicPlaying,
    toggleSfx, isSfxEnabled, stopMainTheme
} from './sounds.js';

export let isPaused = false;
export let isGameOver = false;

let pauseMenuInitialized = false;
let gameOverMenuInitialized = false;

/**
 * Reload the page and return to the splash / main-menu screen.
 */
function goToMainMenu() {
    stopAllTweens();
    stopMainTheme();
    localStorage.removeItem('nsane_restart');
    location.reload();
}

function initPauseMenu() {
    if (pauseMenuInitialized) return;
    const container = document.createElement('div');
    container.innerHTML = pauseHtml.trim();
    document.body.appendChild(container.firstElementChild);

    //  Resume button 
    document.getElementById('resume-btn').addEventListener('click', () => {
        if (isPaused) pauseGame();
    });

    //  Toggle Music button 
    document.getElementById('toggle-music-btn').addEventListener('click', () => {
        const playing = toggleMainTheme();
        const btn = document.getElementById('toggle-music-btn');
        const icon = document.getElementById('music-icon');
        if (playing) {
            btn.classList.remove('muted');
            icon.textContent = '🎵';
        } else {
            btn.classList.add('muted');
            icon.textContent = '🔇';
        }
    });

    //  Toggle SFX button 
    document.getElementById('toggle-sfx-btn').addEventListener('click', () => {
        const enabled = toggleSfx();
        const btn = document.getElementById('toggle-sfx-btn');
        const icon = document.getElementById('sfx-icon');
        if (enabled) {
            btn.classList.remove('muted');
            icon.textContent = '🔊';
        } else {
            btn.classList.add('muted');
            icon.textContent = '🔇';
        }
    });

    //  Main Menu button
    document.getElementById('main-menu-btn').addEventListener('click', goToMainMenu);

    //  Hitbox toggle button
    document.getElementById('hitbox-btn').addEventListener('click', () => {
        window.showHitboxes = !window.showHitboxes;
        const btn = document.getElementById('hitbox-btn');
        if (window.showHitboxes) {
            btn.classList.add('hitbox-active');
        } else {
            btn.classList.remove('hitbox-active');
        }
    });

    pauseMenuInitialized = true;
}

// Call init when module loads
initPauseMenu();

export function pauseGame() {
    if (isGameOver) return;
    isPaused = !isPaused;
    const overlay = document.getElementById('pause-overlay');
    if (overlay) {
        if (isPaused) {
            overlay.classList.remove('hidden');
            // Freeze every active tween in place
            pauseAllTweens();
        } else {
            overlay.classList.add('hidden');
            // Resume every paused tween from where it left off
            resumeAllTweens();
        }
    }
}

function initGameOverMenu() {
    if (gameOverMenuInitialized) return;
    const container = document.createElement('div');
    container.innerHTML = gameOverHtml.trim();
    document.body.appendChild(container.firstElementChild);


    //  Main Menu — go back to the splash screen
    document.getElementById('gameover-menu-btn').addEventListener('click', goToMainMenu);

    gameOverMenuInitialized = true;
}

// Call init when module loads
initGameOverMenu();

export function gameOver() {
    isGameOver = true;
    isPaused = true;

    // Nuke all active tweens so nothing keeps running behind the overlay
    stopAllTweens();

    const overlay = document.getElementById('gameover-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
    }
}