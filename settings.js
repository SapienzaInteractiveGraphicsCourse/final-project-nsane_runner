/**
 * Centralised game settings that derive from the player's menu selections.
 *
 * Usage:
 *   import { settings } from './settings.js';
 *   settings.init();                // reads localStorage written by the menu
 *   settings.getSpeed(distance);    // returns current speed for a given distance
 */

/**
 * Difficulty presets.
 * Each preset defines:
 *   - baseSpeed:     starting forward speed (world-units / second)
 *   - maxSpeed:      cap so the game stays playable
 *   - acceleration:  speed gained per world-unit travelled
 *   - maxLives:      lives the player starts (and caps) at
 *   - spawnDensity:  multiplier for obstacle density (1 = normal)
 */
const DIFFICULTY_PRESETS = {
    easy: {
        baseSpeed: 15,
        maxSpeed: 35,
        acceleration: 0.00008,
        maxLives: 5,
        spawnDensity: 0.7,
    },
    medium: {
        baseSpeed: 20,
        maxSpeed: 50,
        acceleration: 0.00015,
        maxLives: 3,
        spawnDensity: 1.0,
    },
    hard: {
        baseSpeed: 28,
        maxSpeed: 70,
        acceleration: 0.00025,
        maxLives: 2,
        spawnDensity: 1.4,
    },
};

const BASE = import.meta.env.BASE_URL;

export const MAP_BOUNDARY_ASSETS = {
    map1: {
        object1: { path: `${BASE}maps/map 1/cassa/scene.gltf`, name: 'object1', scale: 0.03 },
        object2: { path: `${BASE}maps/map 1/rock_sphere.glb`, name: 'object2', scale: 3 },
        object3: { path: `${BASE}maps/map 1/totem.glb`, name: 'object3', scale: 4 },
    },
    map2: {
        object1: { path: `${BASE}maps/map 2/statua_atzeca.glb`, name: 'object1', scale: 13 },
        object2: { path: `${BASE}maps/map 2/statua_imbruttita.glb`, name: 'object2', scale: 12 },
        object3: { path: `${BASE}maps/map 2/tree.glb`, name: 'object3', scale: 4 },
    },
    map3: {
        object1: { path: `${BASE}maps/map 3/navicella.glb`, name: 'object1', scale: 5.5 },
        object2: { path: `${BASE}maps/map 3/distributore_futuristico.glb`, name: 'object2', scale: 15 },
        object3: { path: `${BASE}maps/map 3/electric_candel.glb`, name: 'object3', scale: 15 },
    },
};

/**
 * The Settings singleton — holds every game-session parameter.
 */
class Settings {
    constructor() {
        // --- Menu selections ---
        /** @type {'crash'|'cortex'} */
        this.character = 'crash';

        /** @type {'map1'|'map2'|'map3'} */
        this.map = 'map1';

        /** @type {'easy'|'medium'|'hard'} */
        this.difficulty = 'medium';

        // --- Derived difficulty parameters ---
        this.baseSpeed = DIFFICULTY_PRESETS.medium.baseSpeed;
        this.maxSpeed = DIFFICULTY_PRESETS.medium.maxSpeed;
        this.acceleration = DIFFICULTY_PRESETS.medium.acceleration;
        this.maxLives = DIFFICULTY_PRESETS.medium.maxLives;
        this.spawnDensity = DIFFICULTY_PRESETS.medium.spawnDensity;

        // --- Runtime state ---
        /** Distance the character has covered (world units). Updated by main loop. */
        this.distanceTravelled = 0;

        /** Current computed score. */
        this.score = 0;
    }

    /**
     * Read the player's selections from localStorage (written by the menu)
     * and derive difficulty parameters.  Call once at game start.
     */
    init() {
        this.character = localStorage.getItem('nsane_character') || 'crash';
        this.map = localStorage.getItem('nsane_map') || 'map1';
        this.difficulty = localStorage.getItem('nsane_difficulty') || 'medium';

        const preset = DIFFICULTY_PRESETS[this.difficulty] || DIFFICULTY_PRESETS.medium;

        this.baseSpeed = preset.baseSpeed;
        this.maxSpeed = preset.maxSpeed;
        this.acceleration = preset.acceleration;
        this.maxLives = preset.maxLives;
        this.spawnDensity = preset.spawnDensity;

        console.log(
            `[Settings] character=${this.character}, map=${this.map}, ` +
            `difficulty=${this.difficulty}, baseSpeed=${this.baseSpeed}`
        );
    }

    // ------------------------------------------------------------------
    //  DYNAMIC SPEED
    // ------------------------------------------------------------------

    /**
     * Returns the current forward speed given how far the player has travelled.
     *
     * Formula: speed = baseSpeed + acceleration × distance
     * Clamped to maxSpeed so the game remains beatable.
     *
     * @param {number} distance  World-units the character has moved forward.
     * @returns {number}         Current speed in world-units / second.
     */
    getSpeed(distance) {
        return Math.min(
            this.baseSpeed + this.acceleration * distance,
            this.maxSpeed
        );
    }

    /**
     * Convenience wrapper that uses the internally tracked distance.
     * @returns {number}
     */
    get currentSpeed() {
        return this.getSpeed(this.distanceTravelled);
    }

    get selectedMapKey() {
        if (this.map === 'map1') return 'map1';
        if (this.map === 'map2') return 'map2';
        return 'map3';
    }

    get boundaryAssets() {
        return MAP_BOUNDARY_ASSETS[this.selectedMapKey];
    }

    // ------------------------------------------------------------------
    //  SCORE
    // ------------------------------------------------------------------

    /**
     * Calculates a composite score from distance, wumpas, and boxes.
     *
     * @param {number} wumpaCount
     * @param {number} boxCount
     * @returns {number}
     */
    computeScore(wumpaCount, boxCount) {
        // 1 point per 10 world-units + 50 per wumpa + 100 per box
        this.score = Math.floor(this.distanceTravelled / 10)
            + wumpaCount * 50
            + boxCount * 100;
        return this.score;
    }
}

/** Exported singleton — import this everywhere. */
export const settings = new Settings();
