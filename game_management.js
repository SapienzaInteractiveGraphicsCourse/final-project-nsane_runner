import './pause.css';
import pauseHtml from './pause.html?raw';
import gameOverHtml from './gameover.html?raw';

export let isPaused = false;
export let isGameOver = false;

let pauseMenuInitialized = false;
let gameOverMenuInitialized = false;

function initPauseMenu() {
    if (pauseMenuInitialized) return;
    const container = document.createElement('div');
    container.innerHTML = pauseHtml.trim();
    document.body.appendChild(container.firstElementChild);

    document.getElementById('resume-btn').addEventListener('click', () => {
        if (isPaused) pauseGame();
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
        } else {
            overlay.classList.add('hidden');
        }
    }
}

function initGameOverMenu() {
    if (gameOverMenuInitialized) return;
    const container = document.createElement('div');
    container.innerHTML = gameOverHtml.trim();
    document.body.appendChild(container.firstElementChild);

    document.getElementById('retry-btn').addEventListener('click', () => {
        location.reload();
    });
    gameOverMenuInitialized = true;
}

// Call init when module loads
initGameOverMenu();

export function gameOver() {
    isGameOver = true;
    isPaused = true;
    const overlay = document.getElementById('gameover-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
    }
}