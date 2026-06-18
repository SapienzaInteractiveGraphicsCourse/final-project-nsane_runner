const BASE = import.meta.env.BASE_URL;
const sfxInstances = [];
let sfxMuted = false;

/**
 * A simple audio wrapper that keeps track of every sound we create 
 * so we can mute or unmute everything at the same time from a menu.
 */
export class Sound {
    /**
     * @param {string} filename - Just the file name inside the public/sounds folder.
     */
    constructor(filename) {
        this.src = `${BASE}sounds/${filename}`;
        this.audio = new Audio(this.src);
        // Track this instance automatically for global mute controls
        sfxInstances.push(this);
    }

    // Rewind and play the sound from the very start
    start() {
        if (sfxMuted) return;
        this.audio.currentTime = 0;
        this.audio.play().catch((err) => {
            console.warn(`Sound: could not play "${this.src}":`, err);
        });
    }

    // Freeze the sound and pop the playback marker back to zero
    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
    }
}

// Background music setup
let mainThemeAudio = null;
let musicMuted = false;

/**
 * Fires up the background music loop. 
 * If it's already running, calling this again won't break anything.
 */
export function startMainTheme() {
    if (!mainThemeAudio) {
        mainThemeAudio = new Audio(`${BASE}sounds/Crash Bandicoot OST - Main Menu.mp3`);
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
 * Flips the background music state between playing and paused.
 * @returns {boolean} true if the music is actively playing now.
 */
export function toggleMainTheme() {
    musicMuted = !musicMuted;
    if (mainThemeAudio) {
        if (musicMuted) {
            mainThemeAudio.pause();
        } else {
            mainThemeAudio.play().catch(() => { });
        }
    }
    return !musicMuted;
}

// Quick check to see if background music is active
export function isMusicPlaying() {
    return !musicMuted;
}

// Kill the background music entirely and reset it
export function stopMainTheme() {
    if (mainThemeAudio) {
        mainThemeAudio.pause();
        mainThemeAudio.currentTime = 0;
    }
}

/**
 * Toggles all sound effects on or off at once, leaving the music alone.
 * If muting, it cuts off any effects currently making noise.
 * @returns {boolean} true if sound effects are now turned on.
 */
export function toggleSfx() {
    sfxMuted = !sfxMuted;
    if (sfxMuted) {
        // Cut the audio on all registered sound effects immediately
        sfxInstances.forEach((s) => s.stop());
    }
    return !sfxMuted;
}

// Quick check to see if sound effects are enabled
export function isSfxEnabled() {
    return !sfxMuted;
}