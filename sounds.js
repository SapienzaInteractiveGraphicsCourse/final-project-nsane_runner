// ── All registered Sound instances (for global mute control) ─────────────
const sfxInstances = [];
let sfxMuted = false;

/**
 * A tiny wrapper around the HTML5 Audio element.
 * Every Sound instance is automatically tracked in a global registry
 * so the pause screen can mute / unmute all SFX at once.
 */
export class Sound {
    /**
     * @param {string} filename - The name of the audio file located in the /sounds directory.
     */
    constructor(filename) {
        this.src = `./sounds/${filename}`;
        this.audio = new Audio(this.src);
        // Register this SFX so we can globally mute it later
        sfxInstances.push(this);
    }

    /**
     * Plays the sound from the beginning.
     */
    start() {
        if (sfxMuted) return;
        this.audio.currentTime = 0;
        this.audio.play().catch((err) => {
            console.warn(`Sound: could not play "${this.src}":`, err);
        });
    }

    /**
     * Stops the sound and resets its playback position.
     */
    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
    }
}

// ── Main Theme (singleton, looping) ──────────────────────────────────────
let mainThemeAudio = null;
let musicMuted = false;

/**
 * Initialises and starts playing the main theme music on loop.
 * Safe to call multiple times — only the first call creates the Audio.
 */
export function startMainTheme() {
    if (!mainThemeAudio) {
        mainThemeAudio = new Audio('./sounds/Crash Bandicoot OST - Main Menu.mp3');
        mainThemeAudio.loop = true;
        mainThemeAudio.volume = 0.4;
    }
    if (!musicMuted) {
        mainThemeAudio.play().catch((err) => {
            console.warn('Could not play main theme:', err);
        });
    }
}

/**
 * Toggles the main theme music on/off.
 * @returns {boolean} true if music is now playing, false if muted.
 */
export function toggleMainTheme() {
    musicMuted = !musicMuted;
    if (mainThemeAudio) {
        if (musicMuted) {
            mainThemeAudio.pause();
        } else {
            mainThemeAudio.play().catch(() => {});
        }
    }
    return !musicMuted;
}

/** @returns {boolean} true if music is currently playing (not muted). */
export function isMusicPlaying() {
    return !musicMuted;
}

/**
 * Stops the main theme completely and resets playback.
 */
export function stopMainTheme() {
    if (mainThemeAudio) {
        mainThemeAudio.pause();
        mainThemeAudio.currentTime = 0;
    }
}

// ── Global SFX mute ──────────────────────────────────────────────────────

/**
 * Toggles all game SFX (everything except the main theme).
 * When muted, ongoing sounds are paused and new .start() calls are no-ops.
 * @returns {boolean} true if SFX are now enabled, false if muted.
 */
export function toggleSfx() {
    sfxMuted = !sfxMuted;
    if (sfxMuted) {
        // Pause every currently-playing SFX
        sfxInstances.forEach((s) => s.stop());
    }
    return !sfxMuted;
}

/** @returns {boolean} true if SFX are currently enabled (not muted). */
export function isSfxEnabled() {
    return !sfxMuted;
}
