import * as THREE from 'three';
import { WumpaFruit, NitroBox, StandardBox, BurubugaBox, NewLife, QuestionBox, Cassa, RockSphere, Totem, Gear, setWumpaModel, setGemModel, setNewLifeModel, setCassaModel, setRockSphereModel, setTotemModel, setGearModel } from './objects.js';
import { gear_animation } from './objects_animations.js';
import { settings } from './settings.js';
import { mat4 } from 'three/tsl';

// --- Module-level tile tracking ---
// Every tile created by initTile is pushed here so removeTiles can manage them.
export const activeTiles = [];

// Tracks the cumulative row offset for the next tile to be placed.
let cumulativePosition = 0;

// Re-export so callers (e.g. main.js) don't need to change their import path.
export { setWumpaModel, setGemModel, setNewLifeModel, setCassaModel, setRockSphereModel, setTotemModel, setGearModel };

export function initTile(scene, num) {

    // --- TILE SETTINGS ---
    var meshSize = 15;
    var rows = 12;
    var lanes = 1;

    var sideColsLeft = 6;
    var sideColsRight = 6;
    var totalCols = sideColsLeft + lanes + sideColsRight;

    // TODO METTERE UNA TEXTURE QUI
    var materialRoad = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    var materialSide = new THREE.MeshStandardMaterial({ color: 0x228B22 });
    var geometry = new THREE.BoxGeometry(1, 1, 1);

    for (var k = 0; k < num; k++) {
        var tile = new THREE.Group();

        // Store the starting X position so removeTiles can compare against it
        tile.userData.startX = cumulativePosition * meshSize;

        // 1. BUILD THE GROUND
        for (var row = 0; row < rows; row++) {
            // Iterate from 0 to totalCols to perfectly match the logic matrix (j index)
            for (let zIndex = 0; zIndex < totalCols; zIndex++) {

                // Dynamically evaluate if the current block is road or grass
                const isRoad = (zIndex >= sideColsLeft && zIndex < sideColsLeft + lanes);
                const currentMaterial = isRoad ? materialRoad : materialSide;

                const mesh = new THREE.Mesh(geometry, currentMaterial);
                mesh.scale.set(meshSize, 1, meshSize);

                mesh.position.y = -0.5;
                mesh.position.x = (row + cumulativePosition) * meshSize;

                // Center the Z position relative to the world origin (Z = 0)
                // e.g., if totalCols is 13, zIndex 0 becomes -6, zIndex 6 becomes 0.
                mesh.position.z = (zIndex - Math.floor(totalCols / 2)) * meshSize;

                mesh.receiveShadow = true;

                tile.add(mesh);
            }
        }

        // 2. GENERATE LOGIC MATRIX
        var mat = initMatrix(rows, totalCols, sideColsLeft, lanes);

        // 3. SPAWN OBJECTS
        var isFirstTile = (num === 3) && (k === 0);
        initObjects(tile, isFirstTile, mat, meshSize, cumulativePosition, totalCols, sideColsLeft);

        // Update the depth position for the next tile
        cumulativePosition += rows;

        // Track the tile and add it to the scene
        activeTiles.push(tile);
        scene.add(tile);
    }
}

function initMatrix(rows, totalCols, sideColsLeft, lanes) {
    let mat = [];

    for (let i = 0; i < rows; i++) {
        mat[i] = new Array(totalCols).fill(0);
    }

    // Dynamically evaluate indexes
    const startRoadJ = sideColsLeft;
    const endRoadJ = sideColsLeft + lanes - 1;
    const centerJ = sideColsLeft + Math.floor(lanes / 2);

    const rowStart = 0;
    const rowMid = Math.floor(rows / 2);
    const rowEnd = rows - 1;
    const gearPosition = rowEnd;
    const meshSize = 15;
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < totalCols; j++) {

            const isRoad = (j >= startRoadJ && j <= endRoadJ);

            // --- ZONA STRADA ---
            if (isRoad) {
                if (j === centerJ) {
                    // Gestiamo lo spawn solo nelle righe designate (Inizio, Metà, Fine)
                    if (i === rowStart || i === rowMid || i === rowEnd) {

                        // La strada è larga 15 (meshSize). Dividiamola in 3 corsie da 5.
                        const laneOffset = meshSize / 3;
                        const subLanes = [-laneOffset, 0, laneOffset]; // [-5, 0, 5]

                        let roadObjects = []; // Array per gli oggetti di questa riga

                        // 1. DECIDI QUANTI OGGETTI SPAWNARE (Da 0 a 3)
                        // Puoi regolare queste percentuali per bilanciare la difficoltà
                        // const randCount = Math.random();
                        // let numObjects = 0;

                        // if (randCount < 0.15) numObjects = 0; // 15% di chance: Riga vuota
                        // else if (randCount < 0.60) numObjects = 1; // 45% di chance: 1 Oggetto
                        // else if (randCount < 0.90) numObjects = 3; // 30% di chance: 2 Oggetti

                        if (i === gearPosition) {
                            roadObjects.push({ type: "gear", offsetZ: -laneOffset });
                        } else {
                            let numObjects = 3; // 10% di chance: 3 Oggetti (Muro)

                            // 2. SELEZIONA LE CORSIE IN MODO CASUALE SENZA RIPETIZIONI
                            // Mescoliamo l'array delle corsie e prendiamo solo i primi 'numObjects' elementi
                            const shuffledLanes = [...subLanes].sort(() => Math.random() - 0.5);
                            const selectedLanes = shuffledLanes.slice(0, numObjects);

                            // FUNZIONE HELPER: Genera un tipo di cassa casuale in base a dei pesi
                            function getRandomBoxType() {
                                const types = ["standard", "question", "burubuga", "nitro"];
                                const weights = [0.40, 0.30, 0.20, 0.10]; // Somma = 1.0 (40%, 30%, 20%, 10%)

                                let r = Math.random();
                                let chosenType = "standard";
                                let sum = 0;

                                for (let t = 0; t < types.length; t++) {
                                    sum += weights[t];
                                    if (r <= sum) {
                                        chosenType = types[t];
                                        break;
                                    }
                                }

                                // La cassa Nitro di solito non ha una variante "up" (alta) nei runner
                                if (chosenType === "nitro") {
                                    return "nitro_box";
                                }

                                // Per le altre casse, decide se spawnano a terra o fluttuanti (_up)
                                const isUp = Math.random() >= 0.5;
                                return isUp ? `${chosenType}_box_up` : `${chosenType}_box`;
                            }

                            // 3. SPAWNA GLI OGGETTI NELLE CORSIE SELEZIONATE
                            selectedLanes.forEach(offsetZ => {
                                const type = getRandomBoxType();
                                roadObjects.push({ type: type, offsetZ: offsetZ });
                            });
                        }

                        // Se abbiamo generato qualcosa, lo salviamo nella matrice logica
                        if (roadObjects.length > 0) {
                            mat[i][j] = roadObjects;
                        }
                    }
                }
            }
        }

        if (Math.random() < 0.9) {
            const shiftInward = 3.5;

            // --- LEFT SIDE  (startRoadJ-1, startRoadJ-2) ---
            const numLeft = Math.floor(Math.random() * 3); // 0, 1 or 2
            if (numLeft === 1) {

                const slot = Math.random() < 0.5 ? startRoadJ - 1 : startRoadJ - 2;
                mat[i][slot] = { offsetZ: shiftInward };
            } else if (numLeft === 2) {
                mat[i][startRoadJ - 1] = { offsetZ: shiftInward };
                mat[i][startRoadJ - 2] = { offsetZ: shiftInward };
            }

            // --- RIGHT SIDE
            const numRight = Math.floor(Math.random() * 3); // 0, 1 or 2
            if (numRight === 1) {

                const slot = Math.random() < 0.5 ? endRoadJ + 1 : endRoadJ + 2;
                mat[i][slot] = { offsetZ: -shiftInward };
            } else if (numRight === 2) {
                mat[i][endRoadJ + 1] = { offsetZ: -shiftInward };
                mat[i][endRoadJ + 2] = { offsetZ: -shiftInward };
            }
        }
    }

    // // Attempt to spawn a Wumpa streak in the road
    // if (Math.random() < 0.7) { // 70% chance to have a streak per tile
    //     const startLaneJ = startRoadJ + Math.floor(Math.random() * lanes);
    //     const streakLength = 5 + Math.floor(Math.random() * 5); // Length between 5 and 9
    //     const startRow = Math.floor(Math.random() * Math.max(1, rows - 5)); // Random start row

    //     generateWumpaStreak(mat, startRow, streakLength, startLaneJ, startRoadJ, endRoadJ);
    // }

    return mat;
}


export function initObjects(tile, isFirstTile, mat, meshSize, cumulativePosition, totalCols, sideColsLeft) {
    // Nel primissimo tile non spawnare oggetti per dare al giocatore
    // un po' di spazio per iniziare a correre.
    if (isFirstTile) return;

    const rows = mat.length;
    const cols = mat[0].length;

    // Calcoliamo le lanes dinamicamente
    const lanes = totalCols - sideColsLeft * 2;

    // Altezza per le casse fluttuanti ("_up")
    const FLOAT_HEIGHT = 7.75;

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const cell = mat[i][j];

            if (cell === 0) continue; // Salta le celle vuote

            // --- Determina se questa colonna fa parte della carreggiata ---
            const isRoad = (j >= sideColsLeft && j < sideColsLeft + lanes);

            if (isRoad) {
                // --- ROAD OBJECTS ---
                // Con la nuova logica, 'cell' ora è un Array di oggetti. 
                // Assicuriamoci che lo sia prima di procedere.
                if (!Array.isArray(cell)) continue;

                // Cicliamo su tutti gli oggetti previsti in questa riga (es. muro di Nitro)
                for (let k = 0; k < cell.length; k++) {
                    const item = cell[k];

                    const cellType = item.type;
                    const offsetZ = item.offsetZ || 0;

                    // Essendo una singola lane logica, passiamo sempre 1 (centro) ai costruttori
                    const laneCol = 1;

                    // Estrapoliamo il suffisso "_up"
                    const isUp = cellType.endsWith('_up');
                    const baseType = isUp ? cellType.replace('_up', '') : cellType;

                    let obj = null;

                    switch (baseType) {
                        case 'standard_box':
                            obj = new StandardBox(meshSize, i, laneCol, cumulativePosition);
                            break;
                        case 'nitro_box':
                            obj = new NitroBox(meshSize, i, laneCol, cumulativePosition);
                            break;
                        case 'burubuga_box':
                            obj = new BurubugaBox(meshSize, i, laneCol, cumulativePosition);
                            break;
                        case 'question_box':
                            obj = new QuestionBox(meshSize, i, laneCol, cumulativePosition);
                            break;
                        case 'new_life':
                            obj = new NewLife(meshSize, i, laneCol, cumulativePosition);
                            break;
                        case 'wumpa_fruit':
                            obj = new WumpaFruit(meshSize, i, laneCol, cumulativePosition);
                            break;
                        case 'gear':
                            const xPos = (i + cumulativePosition) * meshSize;
                            // Farmost left point is roughly -10 or -12. 
                            // Since offsetZ is added below, we subtract it here to ensure it lands exactly on -12.
                            const startZ = -5 - offsetZ;
                            obj = new Gear(xPos, startZ);
                            // We attach a property so we know to animate it after it's fully placed
                            obj.userData.isGear = true;
                            break;
                        default:
                            console.warn(`[initObjects] Unknown road object type: "${cellType}"`);
                            break;
                    }

                    if (obj) {
                        // 1. Spostiamo l'oggetto nella sotto-corsia corretta
                        obj.position.z += offsetZ;

                        // [FONDAMENTALE] Aggiorniamo l'hitbox sull'asse Z
                        if (obj.userData.hitbox) {
                            obj.userData.hitbox.min.z += offsetZ;
                            obj.userData.hitbox.max.z += offsetZ;
                        }

                        // 2. Se è "_up", lo alziamo da terra
                        if (isUp) {
                            obj.position.y += FLOAT_HEIGHT;

                            // Aggiorniamo l'hitbox sull'asse Y
                            if (obj.userData.hitbox) {
                                // Extend the hitbox downwards to make it easier to hit
                                // but keep it above Crash's running height (max.y = 1.5)
                                obj.userData.hitbox.min.y += 3.75;
                                obj.userData.hitbox.max.y += FLOAT_HEIGHT;
                            }
                        }

                        // Call animation for gear only after position.z is finalized
                        if (obj.userData.isGear) {
                            gear_animation(obj);
                        }

                        tile.add(obj);
                    }
                }

            } else {
                // --- SIDE DECORATION OBJECTS ---

                // Coordinata X assoluta nel mondo
                let xPos = (i + cumulativePosition) * meshSize;

                // Coordinata Z assoluta nel mondo
                let zPos = (j - Math.floor(totalCols / 2)) * meshSize;

                // I decori laterali nella tua matrice sono oggetti del tipo { offsetZ: ... }
                // Verifichiamo che sia un oggetto e NON un array (per sicurezza)
                if (typeof cell === 'object' && !Array.isArray(cell) && cell !== null) {
                    if (cell.offsetX) xPos += cell.offsetX;
                    if (cell.offsetZ) zPos += cell.offsetZ;

                    // Aggiungiamo un leggero jitter per renderli più naturali
                    xPos += (Math.random() - 0.5) * 3;
                    zPos += (Math.random() - 0.5) * 3;
                }

                // Scegliamo casualmente uno dei tre modelli decorativi
                const roll = Math.random();
                let decoration;

                if (roll < 0.33) {
                    decoration = new Cassa(xPos, zPos);
                } else if (roll < 0.66) {
                    decoration = new RockSphere(xPos, zPos);
                } else {
                    decoration = new Totem(xPos, zPos);
                }

                if (decoration) {
                    decoration.position.y = 0;
                    tile.add(decoration);
                }
            }
        }
    }
}



/**
 * Removes tiles that have fallen far behind the character and spawns
 * a replacement tile at the front so the world stays populated.
 *
 * The character moves along the POSITIVE X axis, so a tile is "behind"
 * when its last row's X position is well behind the character's current X.
 */
export function removeTiles(scene) {
    const charX = settings.distanceTravelled;
    const REMOVE_THRESHOLD = 100;

    for (let i = activeTiles.length - 1; i >= 0; i--) {
        const tile = activeTiles[i];

        // Find the maximum X position among the tile's ground meshes
        // to determine the tile's trailing edge.
        let tileMaxX = -Infinity;
        tile.children.forEach(child => {
            if (child.position.x > tileMaxX) tileMaxX = child.position.x;
        });

        if (tileMaxX < charX - REMOVE_THRESHOLD) {
            console.log("deleting tile ...");

            // Dispose GPU resources for every object in the tile
            tile.traverse(child => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();

                    const mats = Array.isArray(child.material)
                        ? child.material
                        : [child.material];
                    mats.forEach(mat => {
                        if (!mat) return;
                        // Dispose any texture maps attached to the material
                        for (const key of Object.keys(mat)) {
                            const value = mat[key];
                            if (value && value.isTexture) value.dispose();
                        }
                        mat.dispose();
                    });
                }
            });

            scene.remove(tile);
            activeTiles.splice(i, 1);

            // Spawn a replacement tile at the front
            initTile(scene, 1);
        }
    }
}
