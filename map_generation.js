import * as THREE from 'three';
import { WumpaFruit, NitroBox, StandardBox, BurubugaBox, NewLife, QuestionBox, BoundaryObject, Gear, setWumpaModel, setGemModel, setNewLifeModel, setBoundaryModels, setGearModel } from './objects.js';
import { gear_animation } from './objects_animations.js';
import { settings } from './settings.js';

// --- MAP TEXTURE CONFIGURATION ---
// Each map key maps to a folder under /maps/ with a road and side texture.
const BASE = import.meta.env.BASE_URL;
const MAP_TEXTURES = {
    map1: { road: `${BASE}maps/map 1/cactus_top.png`, side: `${BASE}maps/map 1/cotton_tan.png` },
    map2: { road: `${BASE}maps/map 2/cactus_side.png`, side: `${BASE}maps/map 2/cotton_red.png` },
    map3: { road: `${BASE}maps/map 3/greystone.png`, side: `${BASE}maps/map 3/redsand.png` },
};
import { registerCollisionObject, unregisterCollisionObject } from './check_collisions.js';

// --- Module-level tile tracking ---
// Every tile created by initTile is pushed here so removeTiles can manage them.
export const activeTiles = [];

// Tracks the cumulative row offset for the next tile to be placed.
let cumulativePosition = 0;

const TILE_MESH_SIZE = 15;
const TILE_ROWS = 12;
const TILE_LANES = 1;
const TILE_SIDE_COLS_LEFT = 6;
const TILE_SIDE_COLS_RIGHT = 6;
const TILE_TOTAL_COLS = TILE_SIDE_COLS_LEFT + TILE_LANES + TILE_SIDE_COLS_RIGHT;
const TILE_WIDTH_X = TILE_ROWS * TILE_MESH_SIZE;

let materialRoad = null;
let materialSide = null;
let materialsInitialised = false;

/**
 * Initialises the road & side materials from the selected map's textures.
 * Called lazily on the first initTile() invocation so that settings.map
 * has been populated by the menu.
 */
function ensureMaterials() {
    if (materialsInitialised) return;
    materialsInitialised = true;

    const texLoader = new THREE.TextureLoader();
    const paths = MAP_TEXTURES[settings.selectedMapKey];

    const roadTex = texLoader.load(paths.road);
    roadTex.wrapS = THREE.RepeatWrapping;
    roadTex.wrapT = THREE.RepeatWrapping;
    roadTex.repeat.set(4, 4);

    const sideTex = texLoader.load(paths.side);
    sideTex.wrapS = THREE.RepeatWrapping;
    sideTex.wrapT = THREE.RepeatWrapping;
    sideTex.repeat.set(8, 8);

    materialRoad = new THREE.MeshStandardMaterial({ map: roadTex });
    materialSide = new THREE.MeshStandardMaterial({ map: sideTex });
}
const roadGeometry = new THREE.BoxGeometry(TILE_WIDTH_X, 1, TILE_LANES * TILE_MESH_SIZE);
const sideGeometry = new THREE.BoxGeometry(TILE_WIDTH_X, 1, TILE_SIDE_COLS_LEFT * TILE_MESH_SIZE);

// Re-export so callers (e.g. main.js) don't need to change their import path.
export { setWumpaModel, setGemModel, setNewLifeModel, setBoundaryModels, setGearModel };

export function initTile(scene, num) {
    // Ensure map textures are loaded (deferred until settings are available)
    ensureMaterials();

    // --- TILE SETTINGS ---
    var meshSize = TILE_MESH_SIZE;
    var rows = TILE_ROWS;
    var lanes = TILE_LANES;

    var sideColsLeft = TILE_SIDE_COLS_LEFT;
    var sideColsRight = TILE_SIDE_COLS_RIGHT;
    var totalCols = TILE_TOTAL_COLS;

    for (var k = 0; k < num; k++) {
        var tile = new THREE.Group();

        // Store the starting X position so removeTiles can compare against it
        tile.userData.startX = cumulativePosition * meshSize;
        tile.userData.endX = tile.userData.startX + TILE_WIDTH_X;

        // 1. BUILD THE GROUND
        addGroundStrips(tile, cumulativePosition, meshSize);

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

function addGroundStrips(tile, cumulativePosition, meshSize) {
    const centerX = (cumulativePosition + (TILE_ROWS - 1) / 2) * meshSize;
    const sideCenterOffset = ((TILE_SIDE_COLS_LEFT + TILE_LANES) / 2) * meshSize;

    const road = new THREE.Mesh(roadGeometry, materialRoad);
    road.position.set(centerX, -0.5, 0);
    road.receiveShadow = true;

    const leftSide = new THREE.Mesh(sideGeometry, materialSide);
    leftSide.position.set(centerX, -0.5, -sideCenterOffset);
    leftSide.receiveShadow = true;

    const rightSide = new THREE.Mesh(sideGeometry, materialSide);
    rightSide.position.set(centerX, -0.5, sideCenterOffset);
    rightSide.receiveShadow = true;

    for (const mesh of [road, leftSide, rightSide]) {
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        tile.add(mesh);
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

                        // Strada larga 15, 3 corsie da 5
                        const laneOffset = meshSize / 3;
                        const subLanes = [-laneOffset, 0, laneOffset]; // [-5, 0, 5]

                        let roadObjects = []; // Array per gli oggetti di questa riga

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
                                const types = ["standard", "question", "new_life", "burubuga", "nitro"];
                                const weights = [0.40, 0.20, 0.20, 0.10, 0.10];
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

    // --- WUMPA STREAK SPAWNING ---
    generateWumpaStreak(mat, rows, centerJ, meshSize);

    return mat;
}



const WUMPA_STREAK_CONFIG = {
    // Probability that a Wumpa streak is spawned per tile (0.0 – 1.0)
    streakChance: 0.80,

    // Min / max number of Wumpa fruits in a single streak
    minStreakLength: 5,
    maxStreakLength: 10,

    // If true, each subsequent Wumpa in the streak has a chance to shift
    // to an adjacent sub-lane, creating a diagonal pickup path.
    canSwitchLanesMidStreak: true,

    // Probability (0.0 – 1.0) that each Wumpa shifts to an adjacent lane.
    // Only used when canSwitchLanesMidStreak is true.
    laneSwitchChance: 0.50,
};


/**
 * @param {Array}  mat      - The tile's logic matrix (rows × totalCols).
 * @param {number} rows     - Number of rows in the tile.
 * @param {number} centerJ  - Column index of the road center in the matrix.
 * @param {number} meshSize - World-space size of one grid cell.
 */
function generateWumpaStreak(mat, rows, centerJ, meshSize) {
    const cfg = WUMPA_STREAK_CONFIG;

    // 1. Roll the dice — should we spawn a streak on this tile?
    if (Math.random() >= cfg.streakChance) return;

    // 2. Determine streak length
    const streakLength = cfg.minStreakLength +
        Math.floor(Math.random() * (cfg.maxStreakLength - cfg.minStreakLength + 1));

    // 3. Pick a random starting sub-lane (0 = left, 1 = center, 2 = right)
    const laneOffset = meshSize / 3; // 5
    const subLanes = [-laneOffset, 0, laneOffset]; // [-5, 0, 5]
    let currentLaneIdx = Math.floor(Math.random() * subLanes.length);

    // 4. Pick a random starting row that leaves room for the full streak.
    //    Clamp so we don't exceed the tile boundary.
    const maxStartRow = Math.max(0, rows - streakLength);
    const startRow = Math.floor(Math.random() * (maxStartRow + 1));

    // 5. Place Wumpas row by row
    let placed = 0;
    for (let r = startRow; r < rows && placed < streakLength; r++) {

        // --- Avoid overwriting existing road objects (boxes, gears, etc.) ---
        const existingCell = mat[r][centerJ];
        if (existingCell !== 0) continue; // row already occupied — skip it

        // --- Lane switching logic ---
        if (cfg.canSwitchLanesMidStreak && placed > 0) {
            if (Math.random() < cfg.laneSwitchChance) {
                // Shift to a random *adjacent* lane
                if (currentLaneIdx === 0) {
                    currentLaneIdx = 1;             // left  → center
                } else if (currentLaneIdx === 2) {
                    currentLaneIdx = 1;             // right → center
                } else {
                    // center → randomly left or right
                    currentLaneIdx = Math.random() < 0.5 ? 0 : 2;
                }
            }
        }

        const offsetZ = subLanes[currentLaneIdx];

        // Store as a road-object array (consistent with box spawning format)
        mat[r][centerJ] = [{ type: "wumpa_fruit", offsetZ: offsetZ }];

        placed++;
    }
}


export function initObjects(tile, isFirstTile, mat, meshSize, cumulativePosition, totalCols, sideColsLeft) {
    // In the very first tile don't spawn objects to give the player
    // some space to start running.
    if (isFirstTile) return;

    const rows = mat.length;
    const cols = mat[0].length;

    // Calculate lanes dynamically
    const lanes = totalCols - sideColsLeft * 2;

    // Height of _up objecs
    const FLOAT_HEIGHT = 7.75;

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const cell = mat[i][j];

            if (cell === 0) continue;
            const isRoad = (j >= sideColsLeft && j < sideColsLeft + lanes);

            if (isRoad) {
                // --- ROAD OBJECTS ---
                if (!Array.isArray(cell)) continue;

                for (let k = 0; k < cell.length; k++) {
                    const item = cell[k];

                    const cellType = item.type;
                    const offsetZ = item.offsetZ || 0;
                    const laneCol = 1;

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
                        case 'new_life_box':
                            obj = new NewLife(meshSize, i, laneCol, cumulativePosition);
                            break;
                        case 'wumpa_fruit':
                            obj = new WumpaFruit(meshSize, i, laneCol, cumulativePosition);
                            break;
                        case 'gear':
                            const xPos = (i + cumulativePosition) * meshSize;
                            // set spawn point of gear
                            const startZ = -5 - offsetZ;
                            obj = new Gear(xPos, startZ);
                            obj.userData.isGear = true;
                            break;
                        default:
                            console.warn(`[initObjects] Unknown road object type: "${cellType}"`);
                            break;
                    }

                    if (obj) {
                        // set object position
                        obj.position.z += offsetZ;

                        // update object hitbox
                        if (obj.userData.hitbox) {
                            obj.userData.hitbox.min.z += offsetZ;
                            obj.userData.hitbox.max.z += offsetZ;
                        }

                        // if the object is up, move it
                        if (isUp) {
                            obj.position.y += FLOAT_HEIGHT;

                            // update object hitbox
                            if (obj.userData.hitbox) {
                                // Extend the hitbox downwards to make it easier to hit
                                // but keep it above Crash's running height (max.y = 1.5)
                                obj.userData.hitbox.min.y += FLOAT_HEIGHT - 0.25;
                                obj.userData.hitbox.max.y += FLOAT_HEIGHT;
                            }
                        }

                        // Call animation for gear only after position.z is finalized
                        if (obj.userData.isGear) {
                            gear_animation(obj);
                        }

                        registerCollisionObject(obj);
                        tile.add(obj);
                    }
                }

            } else {
                // --- SIDE DECORATION OBJECTS ---
                let xPos = (i + cumulativePosition) * meshSize;
                let zPos = (j - Math.floor(totalCols / 2)) * meshSize;
                if (typeof cell === 'object' && !Array.isArray(cell) && cell !== null) {
                    if (cell.offsetX) xPos += cell.offsetX;
                    if (cell.offsetZ) zPos += cell.offsetZ;
                    xPos += (Math.random() - 0.5) * 3;
                    zPos += (Math.random() - 0.5) * 3;
                }

                const modelIndex = Math.floor(Math.random() * 3);
                const decoration = new BoundaryObject(modelIndex, xPos, zPos);

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
        const tileMaxX = tile.userData.endX;

        if (tileMaxX < charX - REMOVE_THRESHOLD) {
            console.log("deleting tile ...");

            tile.traverse(child => {
                unregisterCollisionObject(child);
            });

            scene.remove(tile);
            activeTiles.splice(i, 1);

            // Spawn a replacement tile at the front
            initTile(scene, 1);
        }
    }
}
