import * as THREE from 'three';
import { AkuAku } from './characters.js';
import { startup_akuaku_animation } from './objects_animations.js';
import { gameOver } from './game_management.js';
import { settings } from './settings.js';
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

    // Build a Box3 around the character each frame (1×2×1 unit box)
    const charPos = window.character.mesh.position;
    const characterHitbox = new THREE.Box3(
        new THREE.Vector3(charPos.x - 1, charPos.y - 0.5, charPos.z - 1),
        new THREE.Vector3(charPos.x + 1, charPos.y + 1.5, charPos.z + 1)
    );

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

    // Update the HUD counter if any wumpas were collected
    if (toRemove.length > 0 && window.setHudWumpa) {
        window.setHudWumpa(wumpascore);
    }

    return wumpascore;
}

export function checkBoxCollisions(scene) {
    if (!window.character.mesh) return;

    // Build a Box3 around the character each frame (1×2×1 unit box)
    const charPos = window.character.mesh.position;
    const characterHitbox = new THREE.Box3(
        new THREE.Vector3(charPos.x - 1, charPos.y - 0.5, charPos.z - 1),
        new THREE.Vector3(charPos.x + 1, charPos.y + 1.5, charPos.z + 1)
    );

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

                                akuaku.mesh.position.set(-2.5, 3.5, 1.2);

                                akuaku.mesh.rotation.y = -Math.PI / 2;

                                akuaku.mesh.scale.set(0.004, 0.004, 0.004);

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
                        const dropX = charPos.x + 5;
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

                        // const roll = Math.random();
                        let roll = 3;
                        if (roll < 1 / 3) {
                            // Drop 3–5 Wumpa Fruits fanned out along Z
                            const wumpaCount = 3 + Math.floor(Math.random() * 3); // 3, 4, or 5
                            for (let w = 0; w < wumpaCount; w++) {
                                const offsetZ = (w - Math.floor(wumpaCount / 2)) * 0.8;
                                const droppedWumpa = new DroppedWumpa(dropX, dropY, dropZ + offsetZ);
                                scene.add(droppedWumpa);
                            }
                            console.log(`Question box dropped: ${wumpaCount} Wumpa Fruits`);
                        } else if (roll < 2 / 3) {
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

    const charPos = window.character.mesh.position;
    const characterHitbox = new THREE.Box3(
        new THREE.Vector3(charPos.x - 1, charPos.y - 0.5, charPos.z - 1),
        new THREE.Vector3(charPos.x + 1, charPos.y + 1.5, charPos.z + 1)
    );

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
        const maxLives = settings.maxLives;
        window.lives = Math.min(maxLives, (window.lives || 0) + 1);
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

    const charPos = window.character.mesh.position;
    const characterHitbox = new THREE.Box3(
        new THREE.Vector3(charPos.x - 1, charPos.y - 0.5, charPos.z - 1),
        new THREE.Vector3(charPos.x + 1, charPos.y + 1.5, charPos.z + 1)
    );

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