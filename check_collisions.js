import * as THREE from 'three';
import { AkuAku } from './characters.js';
import { startup_akuaku_animation } from './objects_animations.js';
import { gameOver } from './game_management.js';
import { settings } from './settings.js';
import { DroppedWumpa, DroppedLife, DroppedGem } from './objects.js';

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
                            console.log("Aku Aku protected you!");
                            toRemove.push(node);
                        } else {
                            window.lives = Math.max(0, (window.lives || 3) - 1);
                            if (window.setHudLives) window.setHudLives(window.lives);
                            if (window.lives <= 0) {
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
                        window.brokenBoxes = (window.brokenBoxes || 0) + 1;
                        if (window.setHudBoxes) window.setHudBoxes(window.brokenBoxes);
                        // spawn aku aku
                        if (!window.akuaku || !window.akuaku.mesh) {
                            const akuaku = new AkuAku();
                            if (akuaku.mesh) {
                                // --- PARENTING ---
                                // akuaku.mesh is added as a child of character.mesh so it
                                // automatically inherits all of Crash's position, lane slides,
                                // and jumps — no manual coordinate transforms needed.

                                // Local position relative to Crash's own space:
                                //   X = -1.5  → slightly behind Crash (travel direction is +X)
                                //   Y =  3.5  → floating above Crash's head
                                //   Z =  1.2  → offset to one side
                                akuaku.mesh.position.set(-1.5, 3.5, 1.2);

                                // Most GLTF models face their own local +Z by default.
                                // Crash travels along world +X, so rotating the mask by
                                // -90° around Y aligns its +Z with the character's +X (forward).
                                akuaku.mesh.rotation.y = -Math.PI / 2;

                                akuaku.mesh.scale.set(0.004, 0.004, 0.004);

                                // Parent to character mesh — Aku Aku now follows Crash automatically
                                window.character.mesh.add(akuaku.mesh);
                                window.akuaku = akuaku;

                                startup_akuaku_animation(akuaku.mesh); // ROTATE AKU AKU WHEN IT SPAWNS

                            }
                        }

                        // TODO: ADD SOUND EFFECT

                        toRemove.push(node);
                    } else {
                        // --- NO SPIN: take damage ---
                        if (window.akuaku && window.akuaku.mesh) {
                            window.character.mesh.remove(window.akuaku.mesh);
                            window.akuaku = null;
                            console.log("Aku Aku protected you!");
                            toRemove.push(node);
                        } else {
                            window.lives = Math.max(0, (window.lives || 3) - 1);
                            if (window.setHudLives) window.setHudLives(window.lives);
                            if (window.lives <= 0) {
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
                    if (window.akuaku && window.akuaku.mesh) {
                        window.character.mesh.remove(window.akuaku.mesh);
                        window.akuaku = null;
                        console.log("Aku Aku protected you!");
                        toRemove.push(node);
                    } else {
                        window.lives = Math.max(0, (window.lives || 3) - 1);
                        if (window.setHudLives) window.setHudLives(window.lives);
                        if (window.lives <= 0) {
                            gameOver();
                        } else {
                            console.log(`Hit by nitro! Lives remaining: ${window.lives}`);
                            toRemove.push(node);
                        }

                        // TODO: ADD SOUND EFFECT
                    }

                }
            } else if (node.name === 'new_life') {
                if (characterHitbox.intersectsBox(node.userData.hitbox)) {
                    if (window.character.isRotating) {
                        // --- SPIN ATTACK: break the box ---
                        console.log(`${node.name} broken!`);
                        window.brokenBoxes = (window.brokenBoxes || 0) + 1;
                        if (window.setHudBoxes) window.setHudBoxes(window.brokenBoxes);

                        // Drop a crash-face life pickup slightly ahead of the character
                        const dropX = charPos.x + 5;
                        const dropY = 1.5;
                        const dropZ = charPos.z;
                        const droppedLife = new DroppedLife(dropX, dropY, dropZ);
                        scene.add(droppedLife);

                        toRemove.push(node);

                        // TODO: ADD SOUND EFFECT
                    } else {
                        // --- NO SPIN: take damage ---
                        if (window.akuaku && window.akuaku.mesh) {
                            window.character.mesh.remove(window.akuaku.mesh);
                            window.akuaku = null;
                            console.log("Aku Aku protected you!");
                            toRemove.push(node);
                        } else {
                            window.lives = Math.max(0, (window.lives || 3) - 1);
                            if (window.setHudLives) window.setHudLives(window.lives);
                            if (window.lives <= 0) {
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
                        window.brokenBoxes = (window.brokenBoxes || 0) + 1;
                        if (window.setHudBoxes) window.setHudBoxes(window.brokenBoxes);

                        // Randomly select one of three items to drop
                        const dropX = charPos.x + 5;
                        const dropY = 1.5;
                        const dropZ = charPos.z;

                        const roll = Math.random();
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
                            // Drop a Crash Gem
                            const droppedGem = new DroppedGem(dropX, dropY, dropZ);
                            droppedGem.scale.set(0.05, 0.05, 0.05);
                            scene.add(droppedGem);
                            console.log('Question box dropped: Gem');
                        }

                        toRemove.push(node);

                        // TODO: ADD SOUND EFFECT
                    } else {
                        // --- NO SPIN: take damage ---
                        if (window.akuaku && window.akuaku.mesh) {
                            window.character.mesh.remove(window.akuaku.mesh);
                            window.akuaku = null;
                            console.log("Aku Aku protected you!");
                            toRemove.push(node);
                        } else {
                            window.lives = Math.max(0, (window.lives || 3) - 1);
                            if (window.setHudLives) window.setHudLives(window.lives);
                            if (window.lives <= 0) {
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
        const maxLives = settings.maxLives;
        window.lives = Math.min(maxLives, (window.lives || 0) + 1);
        if (window.setHudLives) window.setHudLives(window.lives);
        console.log(`1-Up collected! Lives: ${window.lives}`);
    });
}


/**
 * Checks every dropped_gem node in the scene against the character's bounding box.
 * Collected gems are removed and the wumpa score is incremented by 5.
 */
export function checkDroppedGemCollisions(scene) {
    if (!window.character.mesh) return;

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

    let gemsCollected = 0;
    toRemove.forEach((node) => {
        node.parent?.remove(node);
        gemsCollected++;
        console.log('Gem collected!');
    });

    return gemsCollected;
}