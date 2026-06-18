import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CrashManagement, CortexManagement } from './character_management.js';
import TWEEN from 'three/examples/jsm/libs/tween.module.js';
import { initTile, setWumpaModel, setGemModel, setNewLifeModel, setBoundaryModels, setGearModel } from './map_generation.js';
import { checkWumpaCollisions, checkBoxCollisions, checkDroppedLifeCollisions, checkDroppedGemCollisions, checkGearCollisions, updateHitboxHelpers } from './check_collisions.js';
import { removeGemType } from './objects.js';
import { Crash, Cortex, AkuAku } from './characters.js';
import { isPaused } from './game_management.js';
import { startMainTheme } from './sounds.js';
import { settings } from './settings.js';

const BASE = import.meta.env.BASE_URL;

// Set up the Heads-Up Display by loading the raw HTML and attaching its styling
import './hud.css';
import hudHtml from './hud.html?raw';

(function initHud() {
    const container = document.createElement('div');
    container.innerHTML = hudHtml.trim();
    // Move everything from our temporary container straight onto the live page body
    while (container.firstElementChild) {
        document.body.appendChild(container.firstElementChild);
    }
})();

// Trigger a quick CSS animation bounce whenever a stat changes
function hudPop(el) {
    el.classList.remove('pop');
    void el.offsetWidth;           // Force the browser to reset the element's state immediately
    el.classList.add('pop');
}

// Update the counter on the screen when the player grabs a fruit
window.setHudWumpa = function (count) {
    const el = document.getElementById('wumpa-count');
    if (el) { el.textContent = count; hudPop(el); }
};

// Update the player's remaining lives on the screen
window.setHudLives = function (count) {
    const el = document.getElementById('lives-count');
    if (el) { el.textContent = count; hudPop(el); }
};

// Keep track of how many crates have been smashed
window.setHudBoxes = function (count) {
    const el = document.getElementById('boxes-count');
    if (el) { el.textContent = count; hudPop(el); }
};

// Display the player's overall score formatted with commas
window.setHudScore = function (score) {
    const el = document.getElementById('score-count');
    if (el) el.textContent = score.toLocaleString();
};

// Link the internal item names to their specific HTML container tags
const GEM_HUD_MAP = {
    gem_blue: 'hud-gem-blue',
    gem_green: 'hud-gem-green',
    gem_purple: 'hud-gem-purple',
    gem_red: 'hud-gem-red',
    gem_yellow: 'hud-gem-yellow',
};

// Brighten up a gem icon on the interface once the player collects it
window.setHudGem = function (gemType) {
    const id = GEM_HUD_MAP[gemType];
    if (!id) return;
    const el = document.getElementById(id);
    if (el && !el.classList.contains('collected')) {
        el.classList.add('collected');
    }
};

// Core 3D engine setup including viewport size, rendering quality, and positioning
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(-11, 14, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Cap the resolution for stable performance on high-res displays
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Smooth out the manual camera rotation movements

// Put down basic environmental lighting so the scene elements are visible
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

// Global toggle for rendering collision boundaries during testing
window.showHitboxes = false;

// Tracker for the total number of fruits gathered
let wumpaScore = 0;

// Global references for the active runner and its controller logic
let selectedCharacter;
let character;
let characterManager;

// Loaders for handling different types of 3D source files
const loader = new GLTFLoader();
const fbxLoader = new FBXLoader();

// Fetch all independent models at the same time to speed up the loading screen phase
function loadAssets() {
    const loadGLTF = (path) =>
        new Promise((resolve, reject) => loader.load(path, resolve, undefined, reject));
    const boundaryAssets = settings.boundaryAssets;

    return Promise.all([
        // Use the correct format loader depending on which character was selected
        selectedCharacter === 'crash' ? character.load(loader) : character.load(fbxLoader),
        AkuAku.load(loader),
        loadGLTF(`${BASE}wumpa/scene.gltf`),
        loadGLTF(`${BASE}gem/gems.glb`),
        loadGLTF(`${BASE}newlife/newlife.glb`),
        loadGLTF(boundaryAssets.object1.path),
        loadGLTF(boundaryAssets.object2.path),
        loadGLTF(boundaryAssets.object3.path),
        loadGLTF(`${BASE}gear/gear.glb`)
    ]).then(([, , wumpaGltf, gemGlb, newLifeGltf, object1Gltf, object2Gltf, object3Gltf, gearGltf]) => ({
        wumpaGltf,
        gemGlb,
        newLifeGltf,
        object1Gltf,
        object2Gltf,
        object3Gltf,
        gearGltf,
        boundaryAssets,
    }));
}

// Keep the code waiting until the main menu choices are complete or bypass if restarting
function waitForPlay() {
    return new Promise((resolve) => {
        // Skip the main menu and load straight in if the player chose to restart
        if (localStorage.getItem('nsane_restart') === 'true') {
            localStorage.removeItem('nsane_restart');
            settings.init();
            resolve();
            return;
        }

        // Wait until the user actually interacts and selects their options on the menu
        window.addEventListener('nsane-play', () => {
            settings.init();
            resolve();
        }, { once: true });
    });
}

// Main execution block that coordinates configuration, assets, map population, and loop launching
waitForPlay()
    .then(() => {
        // Read choices from storage and instantiate the appropriate class types
        selectedCharacter = settings.character;
        character = selectedCharacter === 'cortex' ? new Cortex() : new Crash();
        window.character = character;

        characterManager = selectedCharacter === 'cortex'
            ? new CortexManagement()
            : new CrashManagement();

        return loadAssets();
    })
    .then(({ wumpaGltf, gemGlb, newLifeGltf, object1Gltf, object2Gltf, object3Gltf, gearGltf, boundaryAssets }) => {

        // Establish health limits matching the selected difficulty level
        window.lives = settings.maxLives;
        if (window.setHudLives) window.setHudLives(window.lives);

        // Distribute the loaded model references down to the map generator script
        setWumpaModel(wumpaGltf.scene);
        setGemModel(gemGlb.scene);
        setNewLifeModel(newLifeGltf.scene);
        setBoundaryModels([
            { model: object1Gltf.scene, config: boundaryAssets.object1 },
            { model: object2Gltf.scene, config: boundaryAssets.object2 },
            { model: object3Gltf.scene, config: boundaryAssets.object3 },
        ]);
        setGearModel(gearGltf.scene);

        // Generate the first three segments of the infinite track
        initTile(scene, 3);

        // Position the runner on the map and focus the controls target
        scene.add(character.mesh);
        controls.target.set(0, 1, 0);

        // Kick off the automated running animations and key inputs
        characterManager.animations.moveCharacterForward(window.character, scene, camera);
        characterManager.characterMovements(character);

        // Play the theme song and start drawing frames
        startMainTheme();
        animate();

        // Remove the loading splash background to show the interactive game
        const splash = document.getElementById('splash-screen');
        if (splash) splash.classList.add('hidden');

        console.log('Game started!');
    })
    .catch((error) => console.error('Failed to load assets:', error));

// The primary runtime loop rendering frames and checking world behaviors
function animate() {
    requestAnimationFrame(animate);

    if (!isPaused) {
        // Progress any ongoing smooth object movements
        TWEEN.update();

        // Run overlap testing for collectibles, hazards, and items
        wumpaScore = checkWumpaCollisions(scene, wumpaScore);
        checkBoxCollisions(scene);
        checkGearCollisions(scene);
        checkDroppedLifeCollisions(scene);

        // Evaluate item collection rewards and update the corresponding interface counters
        const collectedGems = checkDroppedGemCollisions(scene);
        for (const gemType of collectedGems) {
            if (window.setHudGem) window.setHudGem(gemType);
            removeGemType(gemType);
            wumpaScore += 5; // Reward bonus items for a gem grab
            if (window.setHudWumpa) window.setHudWumpa(wumpaScore);
        }

        // recalculate overall performance stats for the UI display
        if (window.character.mesh) {
            const score = settings.computeScore(wumpaScore, window.brokenBoxes || 0);
            if (window.setHudScore) window.setHudScore(score);
        }

        // Draw debug shapes around physical limits if enabled
        updateHitboxHelpers(scene);

        // Anchor the camera rig coordinates relative to the moving character
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

// Adjust camera proportions and viewport stretching whenever the window changes size
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
});