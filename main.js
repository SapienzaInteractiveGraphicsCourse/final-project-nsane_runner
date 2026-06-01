import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { characterMovements } from './character_management.js';
import TWEEN from 'three/examples/jsm/libs/tween.module.js';
import { moveCharacterForward } from './character_animations.js';
import { initTile, setWumpaModel, setGemModel, setNewLifeModel, setCassaModel, setRockSphereModel, setTotemModel } from './map_generation.js';
import { checkWumpaCollisions, checkBoxCollisions, checkDroppedLifeCollisions, checkDroppedGemCollisions } from './check_collisions.js';
import { Crash, AkuAku } from './characters.js';
import { isPaused } from './game_management.js';
import { settings } from './settings.js';

// ---- HUD: inject template + CSS (same pattern as pause.html / pause.css) ----
import './hud.css';
import hudHtml from './hud.html?raw';

(function initHud() {
    const container = document.createElement('div');
    container.innerHTML = hudHtml.trim();
    document.body.appendChild(container.firstElementChild);
})();

// ---- HUD helpers (exposed globally so game modules can call them) ----
function hudPop(el) {
    el.classList.remove('pop');
    void el.offsetWidth;           // force reflow
    el.classList.add('pop');
}

window.setHudWumpa = function (count) {
    const el = document.getElementById('wumpa-count');
    if (el) { el.textContent = count; hudPop(el); }
};

window.setHudLives = function (count) {
    const el = document.getElementById('lives-count');
    if (el) { el.textContent = count; hudPop(el); }
};

window.setHudBoxes = function (count) {
    const el = document.getElementById('boxes-count');
    if (el) { el.textContent = count; hudPop(el); }
};

window.setHudScore = function (score) {
    const el = document.getElementById('score-count');
    if (el) el.textContent = score.toLocaleString();
};

window.setHudSpeed = function (speed) {
    const el = document.getElementById('speed-count');
    if (el) el.textContent = Math.round(speed);
};

// ---- THREE.js scene setup ----
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(-5, 15, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);


// --- MAP GENERATION ---
// Tracks how many tile-rows have been placed along the X axis.
let cumulativePosition = 0;

// Wumpa collection score
let wumpaScore = 0;

// --- ENDLESS RUNNER SETTINGS ---
const TILE_ROWS = 20;   // rows per tile (must match map_generation.js)
const MESH_SIZE = 5;    // world units per grid cell (must match map_generation.js)
const TILE_WORLD_LEN = TILE_ROWS * MESH_SIZE;  // world-unit length of one tile (= 100)
const TILES_AHEAD = 6;   // how many tiles to keep ahead of the character
const TILES_BEHIND = 1;   // how many tiles to keep behind before recycling

// All active tile entries — each entry is { group: THREE.Group, startX: number }
// where startX is the world-space X coordinate of the tile's first row.
const activeTiles = [];

// Main character instance
const character = new Crash();
window.character = character;

const loader = new GLTFLoader();

/**
 * Loads all game assets in parallel using Promise.all.
 *
 * Assets loaded here:
 *  - Crash Bandicoot character model (via Crash.load())
 *  - /wumpa/scene.gltf  → Wumpa fruit collectible model
 *
 * @returns {Promise<{ wumpaGltf: GLTF }>}
 */
function loadAssets() {
    const loadGLTF = (path) =>
        new Promise((resolve, reject) => loader.load(path, resolve, undefined, reject));

    return Promise.all([
        character.load(loader),
        AkuAku.load(loader),
        loadGLTF('/wumpa/scene.gltf'),
        loadGLTF('/gem/scene.gltf'),
        loadGLTF('/newlife/newlife.glb'),
        loadGLTF("/textures/grass/rock_sphere/scene.gltf"),
        loadGLTF("/textures/grass/cassa/scene.gltf"),
        loadGLTF("/textures/grass/totem/scene.gltf"),
    ]).then(([, , wumpaGltf, gemGltf, newLifeGltf, rockSphereGltf, cassaGltf, totemGltf]) => ({ wumpaGltf, gemGltf, newLifeGltf, rockSphereGltf, cassaGltf, totemGltf }));
}


// --- WAIT FOR PLAY (menu selection) ---
// Returns a Promise that resolves when the player clicks "Play Game"
// after selecting character, map, and difficulty from the menu.
function waitForPlay() {
    return new Promise((resolve) => {
        window.addEventListener('nsane-play', () => {
            // Initialise the Settings singleton from localStorage
            settings.init();
            resolve();
        }, { once: true });
    });
}

// --- BOOTSTRAP ---
// 1. Load all assets in parallel (while the splash screen is visible).
// 2. Wait for the player to click Play.
// 3. Inject the wumpa model, generate the map, add the character, and start.
loadAssets()
    .then(({ wumpaGltf, gemGltf, newLifeGltf, rockSphereGltf, cassaGltf, totemGltf }) => {
        // Assets are ready — now wait for Play button before starting the game.
        return waitForPlay().then(() => ({ wumpaGltf, gemGltf, newLifeGltf, rockSphereGltf, cassaGltf, totemGltf }));
    })
    .then(({ wumpaGltf, gemGltf, newLifeGltf, rockSphereGltf, cassaGltf, totemGltf }) => {

        // --- LIVES (from difficulty) ---
        window.lives = settings.maxLives;
        if (window.setHudLives) window.setHudLives(window.lives);

        // --- WUMPA ---
        setWumpaModel(wumpaGltf.scene);

        // --- GEM ---
        setGemModel(gemGltf.scene);

        // --- NEW LIFE ---
        setNewLifeModel(newLifeGltf.scene);

        // --- WEIRD CASSA
        setCassaModel(cassaGltf.scene);

        // --- ROCK SPHERE
        setRockSphereModel(rockSphereGltf.scene);

        // --- TOTEM
        setTotemModel(totemGltf.scene);

        // --- MAP ---
        // Generate the first batch of tiles (tile 0 is the safe starting platform).
        const firstBatch = 3;
        for (let t = 0; t < firstBatch; t++) {
            const startX = cumulativePosition * MESH_SIZE;
            cumulativePosition = initTile(scene, 1, cumulativePosition, t === 0);
            const group = scene.children[scene.children.length - 1];
            activeTiles.push({ group, startX });
        }

        // --- CHARACTER ---
        scene.add(character.mesh);
        controls.target.set(0, 1, 0);

        // Start the forward movement animation
        moveCharacterForward(window.character, camera);

        // Initialize character movements keyboard listener
        characterMovements(character);

        // Start the render / game loop
        animate();

        console.log('Game started!');

    })
    .catch((error) => console.error('Failed to load assets:', error));




function animate() {
    requestAnimationFrame(animate);

    if (isPaused) return;

    // Update active Tweens
    TWEEN.update();

    // Check wumpa fruit collisions
    wumpaScore = checkWumpaCollisions(scene, wumpaScore);
    // Check box collisions
    checkBoxCollisions(scene);
    // Check dropped life (crash-face) collisions
    checkDroppedLifeCollisions(scene);


    // TODO: MODIFY THIS PART, I WANT TO COLLECT ALL THE GEMS IN THE HUD!
    // Check dropped gem collisions
    const gemsCollected = checkDroppedGemCollisions(scene);
    if (gemsCollected > 0) {
        // Each gem is worth 5 wumpa fruits
        // TODO: MODIFY THIS PART, I WANT TO COLLECT ALL THE GEMS IN THE HUD!
        wumpaScore += gemsCollected * 5;
        if (window.setHudWumpa) window.setHudWumpa(wumpaScore);
    }

    // --- SCORE & SPEED HUD ---
    if (window.character.mesh) {
        const score = settings.computeScore(wumpaScore, window.brokenBoxes || 0);
        if (window.setHudScore) window.setHudScore(score);
        if (window.setHudSpeed) window.setHudSpeed(settings.currentSpeed);
    }

    // --- ENDLESS RUNNER: spawn & recycle tiles ---
    if (window.character.mesh) {
        const charX = window.character.mesh.position.x;

        // Spawn new tiles if the character is getting close to the frontier.
        // cumulativePosition is in grid-rows; multiply by MESH_SIZE for world units.
        while (charX + TILES_AHEAD * TILE_WORLD_LEN > cumulativePosition * MESH_SIZE) {
            const startX = cumulativePosition * MESH_SIZE;
            cumulativePosition = initTile(scene, 1, cumulativePosition, false);
            const group = scene.children[scene.children.length - 1];
            activeTiles.push({ group, startX });
        }

        // Recycle tiles that are too far behind the character.
        // startX + TILE_WORLD_LEN is the world-X of the tile's trailing edge.
        while (
            activeTiles.length > 0 &&
            activeTiles[0].startX + TILE_WORLD_LEN < charX - TILES_BEHIND * TILE_WORLD_LEN
        ) {
            const { group: old } = activeTiles.shift();
            scene.remove(old);
            // Dispose geometries and materials to free GPU memory.
            old.traverse((obj) => {
                if (obj.isMesh) {
                    obj.geometry?.dispose();
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.dispose());
                    } else {
                        obj.material?.dispose();
                    }
                }
            });
        }
    }

    // Keep camera glued to the character
    if (window.character.mesh) {
        camera.position.x = window.character.mesh.position.x - 5;
        camera.position.y = window.character.mesh.position.y + 15;
        camera.position.z = window.character.mesh.position.z;

        camera.lookAt(window.character.mesh.position);
        controls.target.copy(window.character.mesh.position);
    }

    controls.update();
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// animate() is now called inside the bootstrap chain after Play is pressed.
