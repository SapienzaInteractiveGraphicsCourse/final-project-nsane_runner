import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { characterMovements } from './character_management.js';
import TWEEN from 'three/examples/jsm/libs/tween.module.js';
import { moveCharacterForward } from './character_animations.js';
import { initTile, setWumpaModel, setGemModel, setNewLifeModel, setCassaModel, setRockSphereModel, setTotemModel } from './map_generation.js';
import { checkWumpaCollisions, checkBoxCollisions, checkDroppedLifeCollisions, checkDroppedGemCollisions } from './check_collisions.js';
import { removeGemType } from './objects.js';
import { Crash, AkuAku } from './characters.js';
import { isPaused } from './game_management.js';
import { settings } from './settings.js';

// ---- HUD: inject template + CSS (same pattern as pause.html / pause.css) ----
import './hud.css';
import hudHtml from './hud.html?raw';

(function initHud() {
    const container = document.createElement('div');
    container.innerHTML = hudHtml.trim();
    // Inject all root-level elements (the #hud bar AND the #gem-tracker)
    while (container.firstElementChild) {
        document.body.appendChild(container.firstElementChild);
    }
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

// Map gem_type names → HUD element IDs
const GEM_HUD_MAP = {
    gem_blue:   'hud-gem-blue',
    gem_green:  'hud-gem-green',
    gem_purple: 'hud-gem-purple',
    gem_red:    'hud-gem-red',
    gem_yellow: 'hud-gem-yellow',
};

/**
 * Reveals a collected gem in the bottom tracker.
 * @param {string} gemType - e.g. 'gem_purple'
 */
window.setHudGem = function (gemType) {
    const id = GEM_HUD_MAP[gemType];
    if (!id) return;
    const el = document.getElementById(id);
    if (el && !el.classList.contains('collected')) {
        el.classList.add('collected');
    }
};




// ---- THREE.js scene setup ----
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(-11, 14, 0);

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


// Wumpa collection score
let wumpaScore = 0;

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
        loadGLTF('/gem/gems.glb'),
        loadGLTF('/newlife/newlife.glb'),
        loadGLTF("/textures/grass/rock_sphere.glb"),
        loadGLTF("/textures/grass/cassa/scene.gltf"),
        loadGLTF("/textures/grass/totem.glb"),
    ]).then(([, , wumpaGltf, gemGlb, newLifeGltf, rockSphereGltf, cassaGltf, totemGltf]) => ({ wumpaGltf, gemGlb, newLifeGltf, rockSphereGltf, cassaGltf, totemGltf }));
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
    .then(({ wumpaGltf, gemGlb, newLifeGltf, rockSphereGltf, cassaGltf, totemGltf }) => {
        // Assets are ready — now wait for Play button before starting the game.
        return waitForPlay().then(() => ({ wumpaGltf, gemGlb, newLifeGltf, rockSphereGltf, cassaGltf, totemGltf }));
    })
    .then(({ wumpaGltf, gemGlb, newLifeGltf, rockSphereGltf, cassaGltf, totemGltf }) => {

        // --- LIVES (from difficulty) ---
        window.lives = settings.maxLives;
        if (window.setHudLives) window.setHudLives(window.lives);

        // --- WUMPA ---
        setWumpaModel(wumpaGltf.scene);

        // --- GEM ---
        setGemModel(gemGlb.scene);

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
        initTile(scene, 3);


        // --- CHARACTER ---
        scene.add(character.mesh);
        controls.target.set(0, 1, 0);

        // Start the forward movement animation
        moveCharacterForward(window.character, scene, camera);

        // Initialize character movements keyboard listener
        characterMovements(character);

        // Start the render / game loop
        animate();

        console.log('Game started!');

    })
    .catch((error) => console.error('Failed to load assets:', error));




function animate() {
    requestAnimationFrame(animate);

    if (!isPaused) {
        // Update active Tweens
        TWEEN.update();

        // Check wumpa fruit collisions
        wumpaScore = checkWumpaCollisions(scene, wumpaScore);
        // Check box collisions
        checkBoxCollisions(scene);
        // Check dropped life (crash-face) collisions
        checkDroppedLifeCollisions(scene);


        // Check dropped gem collisions — returns an array of gem type strings
        const collectedGems = checkDroppedGemCollisions(scene);
        for (const gemType of collectedGems) {
            // Reveal this gem colour in the bottom HUD tracker
            if (window.setHudGem) window.setHudGem(gemType);
            // Remove from the droppable pool so it can’t spawn again
            removeGemType(gemType);
            // Each gem is also worth 5 wumpa fruits
            wumpaScore += 5;
            if (window.setHudWumpa) window.setHudWumpa(wumpaScore);
        }

        // --- SCORE & SPEED HUD ---
        if (window.character.mesh) {
            const score = settings.computeScore(wumpaScore, window.brokenBoxes || 0);
            if (window.setHudScore) window.setHudScore(score);
            // TODO: Adjust if (window.setHudSpeed) window.setHudSpeed(settings.currentSpeed);
        }

        // Keep camera glued to the character
        if (window.character.mesh) {
            camera.position.x = window.character.mesh.position.x - 11;
            camera.position.y = window.character.mesh.position.y + 14;
            camera.position.z = window.character.mesh.position.z;

            camera.lookAt(window.character.mesh.position);
            controls.target.copy(window.character.mesh.position);
        }
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
