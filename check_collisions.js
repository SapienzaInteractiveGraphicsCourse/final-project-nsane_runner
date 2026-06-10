import * as THREE from 'three';
import { AkuAku } from './characters.js';
import { startup_akuaku_animation } from './objects_animations.js';
import { gameOver } from './game_management.js';
import { DroppedWumpa, DroppedLife, DroppedGem, getRandomGemType } from './objects.js';
import { Sound } from './sounds.js';

// ── Pre-instantiated sound effects (singletons) ──────────────────────────
const wumpaSound = new Sound('wumpa.wav');
const crateBreakSound = new Sound('createBreak.wav');
const akuakuSound = new Sound('akuaku.wav');
const akuakuVanish = new Sound('akuaku_vanish.wav');
const gemSound = new Sound('gemSound.wav');
const lifeSound = new Sound('life.wav');
const nitroSound = new Sound('nitro.wav');
const gameOverSound = new Sound('woah.wav');

/**
 * Checks every wumpa_fruit in the scene against the character's bounding box.
 * Collected fruits are removed from the scene and the score is incremented.
 */
export function checkWumpaCollisions(scene, wumpascore) {
    if (!window.character.mesh) return;

    const characterHitbox = window.character.get_hitbox();

    // Collect nodes to remove after traversal (avoid mutating mid-traverse)
    const toRemove = [];

    scene.traverse((node) => {
        if (node.name === 'wumpa_fruit' && node.userData.hitbox) {
            if (characterHitbox.intersectsBox(node.userData.hitbox)) {
                toRemove.push(node);
            }
        }
    });

    toRemove.forEach((node) => {
        node.parent?.remove(node);
        wumpascore++;
        wumpaSound.start();
        console.log(`Wumpa collected! Score: ${wumpascore}`);
    });

    // 100-wumpa bonus: spawn a dropped life and reset counter
    if (wumpascore >= 100) {
        wumpascore = 0;
        if (window.character?.mesh) {
            const charPos = window.character.mesh.position;
            const dropX = charPos.x + 7;
            const dropY = 1.5;
            const dropZ = charPos.z;
            const droppedLife = new DroppedLife(dropX, dropY, dropZ);
            scene.add(droppedLife);
            console.log('100 Wumpas! Bonus life spawned.');
        }
    }

    // Update the HUD counter if any wumpas were collected
    if (toRemove.length > 0 && window.setHudWumpa) {
        window.setHudWumpa(wumpascore);
    }

    return wumpascore;
}

export function checkBoxCollisions(scene) {
    if (!window.character.mesh) return;

    const charPos = window.character.mesh.position;
    const characterHitbox = window.character.get_hitbox();

    // Collect nodes to remove after traversal (avoid mutating mid-traverse)
    const toRemove = [];

    scene.traverse((node) => {
        if (node.userData && node.userData.hitbox) {
            if (node.name === 'standard_box') {
                if (characterHitbox.intersectsBox(node.userData.hitbox)) {
                    if (window.character.isRotating) {
                        // --- SPIN ATTACK: break the box ---
                        console.log(`${node.name} broken!`);
                        crateBreakSound.start();
                        window.brokenBoxes = (window.brokenBoxes || 0) + 1;
                        if (window.setHudBoxes) window.setHudBoxes(window.brokenBoxes);

                        // Drop a wumpa fruit slightly ahead of the character
                        const dropX = charPos.x + 8;
                        const dropY = 1.5;
                        const dropZ = charPos.z;
                        const droppedWumpa = new DroppedWumpa(dropX, dropY, dropZ);
                        scene.add(droppedWumpa);

                        toRemove.push(node);
                    } else {
                        // --- NO SPIN: take damage ---
                        if (window.akuaku && window.akuaku.mesh) {
                            window.character.mesh.remove(window.akuaku.mesh);
                            window.akuaku = null;
                            akuakuVanish.start();
                            console.log("Aku Aku protected you!");
                            toRemove.push(node);
                        } else {
                            window.lives = Math.max(0, (window.lives || 3) - 1);
                            if (window.setHudLives) window.setHudLives(window.lives);
                            if (window.lives <= 0) {
                                gameOverSound.start();
                                gameOver();
                            } else {
                                console.log(`Hit by box! Lives remaining: ${window.lives}`);
                                toRemove.push(node);
                            }
                        }
                    }
                }
            } else if (node.name === 'burubuga_box') {
                if (characterHitbox.intersectsBox(node.userData.hitbox)) {
                    if (window.character.isRotating) {
                        // --- SPIN ATTACK: break the box ---
                        console.log(`${node.name} broken!`);
                        crateBreakSound.start();
                        window.brokenBoxes = (window.brokenBoxes || 0) + 1;
                        if (window.setHudBoxes) window.setHudBoxes(window.brokenBoxes);
                        // spawn aku aku
                        if (!window.akuaku || !window.akuaku.mesh) {
                            const akuaku = new AkuAku();
                            if (akuaku.mesh) {

                                // Compensate for the parent mesh's scale AND rotation
                                // so Aku Aku looks identical regardless of character.
                                // Crash: scale 1, rotY 0 | Cortex: scale 0.004, rotY π/2
                                const parentScale = window.character.mesh.scale.x;
                                const invScale = 1 / parentScale;
                                const parentRotY = window.character.mesh.rotation.y;

                                // Counter-rotate the desired world offset into parent local space
                                const wx = -2.5, wy = 3.5, wz = 1.2;
                                const cosR = Math.cos(parentRotY);
                                const sinR = Math.sin(parentRotY);
                                akuaku.mesh.position.set(
                                    ( wx * cosR - wz * sinR) * invScale,
                                      wy * invScale,
                                    ( wx * sinR + wz * cosR) * invScale
                                );

                                // Counter-rotate the desired world-space facing
                                akuaku.mesh.rotation.y = -Math.PI / 2 - parentRotY;

                                const akuScale = 0.004 * invScale;
                                akuaku.mesh.scale.set(akuScale, akuScale, akuScale);

                                window.character.mesh.add(akuaku.mesh);
                                window.akuaku = akuaku;

                                startup_akuaku_animation(akuaku.mesh); // ROTATE AKU AKU WHEN IT SPAWNS

                                akuakuSound.start();
                            }
                        }

                        toRemove.push(node);
                    } else {
                        // --- NO SPIN: take damage ---
                        if (window.akuaku && window.akuaku.mesh) {
                            window.character.mesh.remove(window.akuaku.mesh);
                            window.akuaku = null;
                            akuakuVanish.start();
                            console.log("Aku Aku protected you!");
                            toRemove.push(node);
                        } else {
                            window.lives = Math.max(0, (window.lives || 3) - 1);
                            if (window.setHudLives) window.setHudLives(window.lives);
                            if (window.lives <= 0) {
                                gameOverSound.start();
                                gameOver();
                            } else {
                                console.log(`Hit by box! Lives remaining: ${window.lives}`);
                                toRemove.push(node);
                            }
                        }
                    }
                }
            } else if (node.name === 'nitro_box') {
                if (characterHitbox.intersectsBox(node.userData.hitbox)) {
                    nitroSound.start();
                    if (window.akuaku && window.akuaku.mesh) {
                        window.character.mesh.remove(window.akuaku.mesh);
                        window.akuaku = null;
                        akuakuVanish.start();
                        console.log("Aku Aku protected you!");
                        toRemove.push(node);
                    } else {
                        window.lives = Math.max(0, (window.lives || 3) - 1);
                        if (window.setHudLives) window.setHudLives(window.lives);
                        if (window.lives <= 0) {
                            gameOverSound.start();
                            gameOver();
                        } else {
                            console.log(`Hit by nitro! Lives remaining: ${window.lives}`);
                            toRemove.push(node);
                        }
                    }

                }
            } else if (node.name === 'new_life') {
                if (characterHitbox.intersectsBox(node.userData.hitbox)) {
                    if (window.character.isRotating) {
                        // --- SPIN ATTACK: break the box ---
                        console.log(`${node.name} broken!`);
                        crateBreakSound.start();
                        window.brokenBoxes = (window.brokenBoxes || 0) + 1;
                        if (window.setHudBoxes) window.setHudBoxes(window.brokenBoxes);

                        // Drop a crash-face life pickup slightly ahead of the character
                        const dropX = charPos.x + 7;
                        const dropY = 1.5;
                        const dropZ = charPos.z;
                        const droppedLife = new DroppedLife(dropX, dropY, dropZ);
                        scene.add(droppedLife);

                        toRemove.push(node);
                    } else {
                        // --- NO SPIN: take damage ---
                        if (window.akuaku && window.akuaku.mesh) {
                            window.character.mesh.remove(window.akuaku.mesh);
                            window.akuaku = null;
                            akuakuVanish.start();
                            console.log("Aku Aku protected you!");
                            toRemove.push(node);
                        } else {
                            window.lives = Math.max(0, (window.lives || 3) - 1);
                            if (window.setHudLives) window.setHudLives(window.lives);
                            if (window.lives <= 0) {
                                gameOverSound.start();
                                gameOver();
                            } else {
                                console.log(`Hit by box! Lives remaining: ${window.lives}`);
                                toRemove.push(node);
                            }
                        }
                    }
                }
            } else if (node.name === 'question_box') {
                if (characterHitbox.intersectsBox(node.userData.hitbox)) {
                    if (window.character.isRotating) {
                        // --- SPIN ATTACK: break the box ---
                        console.log(`${node.name} broken!`);
                        crateBreakSound.start();
                        window.brokenBoxes = (window.brokenBoxes || 0) + 1;
                        if (window.setHudBoxes) window.setHudBoxes(window.brokenBoxes);

                        // Randomly select one of three items to drop
                        const dropX = charPos.x + 10;
                        const dropY = 1.5;
                        const dropZ = charPos.z;

                        const roll = Math.floor(Math.random() * 3) + 1; // 1, 2, or 3

                        if (roll === 1) {
                            // Drop 3–5 Wumpa Fruits fanned out along Z
                            const wumpaCount = 3 + Math.floor(Math.random() * 3); // 3, 4, or 5
                            for (let w = 0; w < wumpaCount; w++) {
                                const offsetZ = (w - Math.floor(wumpaCount / 2)) * 0.8;
                                const droppedWumpa = new DroppedWumpa(dropX, dropY, dropZ + offsetZ);
                                scene.add(droppedWumpa);
                            }
                            console.log(`Question box dropped: ${wumpaCount} Wumpa Fruits`);
                        } else if (roll === 2) {
                            // Drop a Crash Extra Life
                            const droppedLife = new DroppedLife(dropX, dropY, dropZ);
                            scene.add(droppedLife);
                            console.log('Question box dropped: Extra Life');
                        } else {
                            // Drop a random Crash Gem (if any remain uncollected)
                            const gemType = getRandomGemType();
                            if (gemType) {
                                const droppedGem = new DroppedGem(dropX, dropY, dropZ, gemType);
                                scene.add(droppedGem);
                                console.log(`Question box dropped: ${gemType}`);
                            } else {
                                // All gems collected — fall back to wumpas (90%) or life (10%)
                                if (Math.random() < 0.9) {
                                    const droppedWumpa = new DroppedWumpa(dropX, dropY, dropZ);
                                    scene.add(droppedWumpa);
                                    console.log('Question box dropped: Wumpa (all gems collected)');
                                } else {
                                    const droppedLife = new DroppedLife(dropX, dropY, dropZ);
                                    scene.add(droppedLife);
                                    console.log('Question box dropped: Extra Life (all gems collected)');
                                }
                            }
                        }

                        toRemove.push(node);
                    } else {
                        // --- NO SPIN: take damage ---
                        if (window.akuaku && window.akuaku.mesh) {
                            window.character.mesh.remove(window.akuaku.mesh);
                            window.akuaku = null;
                            akuakuVanish.start();
                            console.log("Aku Aku protected you!");
                            toRemove.push(node);
                        } else {
                            window.lives = Math.max(0, (window.lives || 3) - 1);
                            if (window.setHudLives) window.setHudLives(window.lives);
                            if (window.lives <= 0) {
                                gameOverSound.start();
                                gameOver();
                            } else {
                                console.log(`Hit by box! Lives remaining: ${window.lives}`);
                                toRemove.push(node);
                            }
                        }
                    }
                }
            }
        }
    });

    toRemove.forEach((node) => {
        node.parent?.remove(node);
    });
}


/**
 * Checks every dropped_life node in the scene against the character's bounding box.
 * Collected life pickups are removed and the lives counter is incremented.
 */
export function checkDroppedLifeCollisions(scene) {
    if (!window.character.mesh) return;

    const characterHitbox = window.character.get_hitbox();

    const toRemove = [];

    scene.traverse((node) => {
        if (node.name === 'dropped_life' && node.userData.hitbox) {
            if (characterHitbox.intersectsBox(node.userData.hitbox)) {
                toRemove.push(node);
            }
        }
    });

    toRemove.forEach((node) => {
        node.parent?.remove(node);
        lifeSound.start();
        window.lives = (window.lives || 0) + 1;
        if (window.setHudLives) window.setHudLives(window.lives);
        console.log(`1-Up collected! Lives: ${window.lives}`);
    });
}


/**
 * Checks every dropped_gem node in the scene against the character's bounding box.
 * Collected gems are removed and their types are returned so the HUD can be updated.
 * @returns {string[]} Array of collected gem type names (e.g. 'gem_purple').
 */
export function checkDroppedGemCollisions(scene) {
    if (!window.character.mesh) return [];

    const characterHitbox = window.character.get_hitbox();

    const toRemove = [];

    scene.traverse((node) => {
        if (node.name === 'dropped_gem' && node.userData.hitbox) {
            if (characterHitbox.intersectsBox(node.userData.hitbox)) {
                toRemove.push(node);
            }
        }
    });

    const collectedTypes = [];
    toRemove.forEach((node) => {
        node.parent?.remove(node);
        gemSound.start();
        collectedTypes.push(node.userData.gemType);
        console.log(`Gem collected: ${node.userData.gemType}`);
    });

    return collectedTypes;
}

export function checkGearCollisions(scene) {
    if (!window.character.mesh) return;

    const characterHitbox = window.character.get_hitbox();

    const toRemove = [];

    const tempVector = new THREE.Vector3();

    scene.traverse((node) => {
        if (node.name === 'gear') {

            node.getWorldPosition(tempVector);
            const gearHitbox = new THREE.Sphere(tempVector, node.userData.hitboxRadius);

            if (characterHitbox.intersectsSphere(gearHitbox)) {
                nitroSound.start();

                if (window.akuaku && window.akuaku.mesh) {
                    window.character.mesh.remove(window.akuaku.mesh);
                    window.akuaku = null;
                    akuakuVanish.start();
                    console.log("Aku Aku protected you from the gear!");
                    toRemove.push(node);
                } else {
                    window.lives = Math.max(0, (window.lives || 3) - 1);
                    if (window.setHudLives) window.setHudLives(window.lives);

                    if (window.lives <= 0) {
                        gameOverSound.start();
                        gameOver();
                    } else {
                        console.log(`Hit by gear! Lives remaining: ${window.lives}`);
                        toRemove.push(node);
                    }
                }
            }
        }
    });

    toRemove.forEach((node) => {
        node.parent?.remove(node);
    });
}

// ── Hitbox visualisation helpers ──────────────────────────────────────────
// Managed set of Box3Helper instances currently in the scene.
const _hitboxHelpers = new Set();

/**
 * Creates or destroys Box3Helper wireframes for every active hitbox in
 * the scene, controlled by the `window.showHitboxes` boolean flag.
 *
 * Call this once per frame from the game loop.
 * @param {THREE.Scene} scene
 */
export function updateHitboxHelpers(scene) {
    // --- Tear down previous frame's helpers (always, to keep in sync) ---
    if (_hitboxHelpers.size > 0) {
        for (const h of _hitboxHelpers) {
            scene.remove(h);
            if (h.geometry) h.geometry.dispose();
            if (h.material) h.material.dispose();
        }
        _hitboxHelpers.clear();
    }

    if (!window.showHitboxes) return;

    // --- Character hitbox (cyan) ---
    if (window.character?.mesh) {
        const charBox = window.character.get_hitbox();
        const charHelper = new THREE.Box3Helper(charBox, 0x00ffff);
        charHelper.name = '_hitbox_helper';
        scene.add(charHelper);
        _hitboxHelpers.add(charHelper);
    }

    // --- Object hitboxes (green for collectibles, red for hazards) ---
    const hazardNames = new Set([
        'nitro_box', 'gear', 'standard_box', 'burubuga_box', 'question_box', 'new_life'
    ]);

    scene.traverse((node) => {
        if (node.name === '_hitbox_helper') return;

        // Static / stored hitbox
        if (node.userData?.hitbox) {
            const color = hazardNames.has(node.name) ? 0xff3333 : 0x33ff33;
            const helper = new THREE.Box3Helper(node.userData.hitbox, color);
            helper.name = '_hitbox_helper';
            scene.add(helper);
            _hitboxHelpers.add(helper);
        }

        // Gear uses a dynamic hitbox (computed from the mesh each frame)
        if (node.name === 'gear' && !node.userData?.hitbox) {
            const gearBox = new THREE.Box3().setFromObject(node);
            gearBox.expandByScalar(-0.5);
            const helper = new THREE.Box3Helper(gearBox, 0xff3333);
            helper.name = '_hitbox_helper';
            scene.add(helper);
            _hitboxHelpers.add(helper);
        }
    });
}
