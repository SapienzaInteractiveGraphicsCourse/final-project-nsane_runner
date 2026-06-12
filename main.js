import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CrashManagement, CortexManagement } from './character_management.js';
import TWEEN from 'three/examples/jsm/libs/tween.module.js';
import { initTile, setWumpaModel, setGemModel, setNewLifeModel, setCassaModel, setRockSphereModel, setTotemModel, setGearModel } from './map_generation.js';
import { checkWumpaCollisions, checkBoxCollisions, checkDroppedLifeCollisions, checkDroppedGemCollisions, checkGearCollisions, updateHitboxHelpers } from './check_collisions.js';
import { removeGemType } from './objects.js';
import { Crash, Cortex, AkuAku } from './characters.js';
import { isPaused } from './game_management.js';
import { startMainTheme } from './sounds.js';
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
    gem_blue: 'hud-gem-blue',
    gem_green: 'hud-gem-green',
    gem_purple: 'hud-gem-purple',
    gem_red: 'hud-gem-red',
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

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);


// Hitbox debug visualisation (toggled via the pause menu button)
window.showHitboxes = false;

// Wumpa collection score
let wumpaScore = 0;

// Main character + manager — created after the player clicks Play
// so the menu selection from localStorage is available.
let selectedCharacter;
let character;
let characterManager;

//this code will have to be further optimized
const loader = new GLTFLoader();
const fbxLoader = new FBXLoader();

const MAP_BOUNDARY_ASSETS = {
    map1: {
        cassa: { path: '/maps/map 1/cassa/scene.gltf', name: 'cassa', scale: 0.03 },
        rockSphere: { path: '/maps/map 1/rock_sphere.glb', name: 'rock_sphere', scale: 3 },
        totem: { path: '/maps/map 1/totem.glb', name: 'totem', scale: 4 },
    },
    map2: {
        cassa: { path: '/maps/map 2/statua_atzeca.glb', name: 'statua_atzeca', scale: 4 },
        rockSphere: { path: '/maps/map 2/statua_imbruttita.glb', name: 'statua_imbruttita', scale: 4 },
        totem: { path: '/maps/map 2/tree.glb', name: 'tree', scale: 4 },
    },
    map3: {
        cassa: { path: '/maps/map 3/navicella.glb', name: 'navicella', scale: 4 },
        rockSphere: { path: '/maps/map 3/distributore_futuristico.glb', name: 'distributore_futuristico', scale: 4 },
        totem: { path: '/maps/map 3/electric_candel.glb', name: 'electric_candel', scale: 4 },
    },
};

function getSelectedMapKey() {
    if (settings.map === 'map1') return 'map1';
    if (settings.map === 'map2') return 'map2';
    return 'map3';
}

/**
 * Loads all game assets in parallel using Promise.all.
 *
 * Assets loaded here:
 *  - Character model (Crash via GLTFLoader, Cortex via FBXLoader)
 *  - /wumpa/scene.gltf  → Wumpa fruit collectible model
 *
 * @returns {Promise<{ wumpaGltf: GLTF }>}
 */
function loadAssets() {
    const loadGLTF = (path) =>
        new Promise((resolve, reject) => loader.load(path, resolve, undefined, reject));
    const boundaryAssets = MAP_BOUNDARY_ASSETS[getSelectedMapKey()];

    return Promise.all([
        selectedCharacter === 'crash' ? character.load(loader) : character.load(fbxLoader),
        AkuAku.load(loader),
        loadGLTF('/wumpa/scene.gltf'),
        loadGLTF('/gem/gems.glb'),
        loadGLTF('/newlife/newlife.glb'),
        loadGLTF(boundaryAssets.rockSphere.path),
        loadGLTF(boundaryAssets.cassa.path),
        loadGLTF(boundaryAssets.totem.path),
        loadGLTF("/gear/gear.glb")
    ]).then(([, , wumpaGltf, gemGlb, newLifeGltf, rockSphereGltf, cassaGltf, totemGltf, gearGltf]) => ({
        wumpaGltf,
        gemGlb,
        newLifeGltf,
        rockSphereGltf,
        cassaGltf,
        totemGltf,
        gearGltf,
        boundaryAssets,
    }));
}


// --- WAIT FOR PLAY (menu selection) ---
// Returns a Promise that resolves when the player clicks "Play Game"
// after selecting character, map, and difficulty from the menu.
// Also handles auto-restart: if nsane_restart is set in localStorage
// (by the Restart / Play Again buttons), skip the splash screen and
// resolve immediately using the previously saved selections.
function waitForPlay() {
    return new Promise((resolve) => {
        // ── Auto-restart path (skip splash) ──────────────────────────────
        if (localStorage.getItem('nsane_restart') === 'true') {
            localStorage.removeItem('nsane_restart');

            // Selections are still in localStorage from the original Play
            settings.init();
            resolve();
            return;
        }

        // ── Normal path (wait for the player to click Play) ──────────────
        window.addEventListener('nsane-play', () => {
            // Initialise the Settings singleton from localStorage
            settings.init();
            resolve();
        }, { once: true });
    });
}

// --- BOOTSTRAP ---
// 1. Wait for the player to click Play (so we know their character choice).
// 2. Create the character + manager based on the selection.
// 3. Load all assets in parallel.
// 4. Inject models, generate the map, add the character, and start.
waitForPlay()
    .then(() => {
        // Now localStorage has the player's selections — create character
        selectedCharacter = settings.character;   // 'crash' or 'cortex'
        character = selectedCharacter === 'cortex' ? new Cortex() : new Crash();
        window.character = character;

        characterManager = selectedCharacter === 'cortex'
            ? new CortexManagement()
            : new CrashManagement();

        return loadAssets();
    })
    .then(({ wumpaGltf, gemGlb, newLifeGltf, rockSphereGltf, cassaGltf, totemGltf, gearGltf, boundaryAssets }) => {

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
        setCassaModel(cassaGltf.scene, boundaryAssets.cassa);

        // --- ROCK SPHERE
        setRockSphereModel(rockSphereGltf.scene, boundaryAssets.rockSphere);

        // --- TOTEM
        setTotemModel(totemGltf.scene, boundaryAssets.totem);

        setGearModel(gearGltf.scene);

        // --- MAP ---
        // Generate the first batch of tiles (tile 0 is the safe starting platform).
        initTile(scene, 3);


        // --- CHARACTER ---
        scene.add(character.mesh);
        controls.target.set(0, 1, 0);

        // Start the forward movement animation
        characterManager.animations.moveCharacterForward(window.character, scene, camera);

        // Initialize character movements keyboard listener
        characterManager.characterMovements(character);

        // Start the main theme music
        startMainTheme();

        // Start the render / game loop
        animate();

        // Hide splash screen now that everything is ready
        const splash = document.getElementById('splash-screen');
        if (splash) splash.classList.add('hidden');

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
        // Check gear collisions
        checkGearCollisions(scene);
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

        // Update hitbox debug visualisation
        updateHitboxHelpers(scene);

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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
});
