import * as THREE from 'three';
import { WumpaFruit, NitroBox, StandardBox, BurubugaBox, NewLife, QuestionBox, Cassa, RockSphere, Totem, setWumpaModel, setGemModel, setNewLifeModel, setCassaModel, setRockSphereModel, setTotemModel } from './objects.js';
import { settings } from './settings.js';

// --- Module-level tile tracking ---
// Every tile created by initTile is pushed here so removeTiles can manage them.
export const activeTiles = [];

// Tracks the cumulative row offset for the next tile to be placed.
let cumulativePosition = 0;

// Re-export so callers (e.g. main.js) don't need to change their import path.
export { setWumpaModel, setGemModel, setNewLifeModel, setCassaModel, setRockSphereModel, setTotemModel };

/**
 * Generates a single tile chunk and adds it to the scene.
 *
 * The character moves forward along the POSITIVE X axis.
 * Therefore:
 *   - Tile depth (rows) extends along the X axis.
 *   - Lanes (left / center / right) are offset along the Z axis.
 *
 * @param {THREE.Scene} scene              - The Three.js scene to add tiles to.
 * @param {number}      num                - Number of tiles to generate (kept for backwards compat).
 * @returns {number} Updated cumulativePosition after generating all tiles.
 */
export function initTile(scene, num) {

    // --- TILE SETTINGS ---
    var meshSize = 15;     // Preso da meshWidth e meshDepth (15)
    var rows = 6;         // Preso da jMax = 5 (il ciclo da 0 a 5 genera 6 righe in totale)
    var lanes = 1;        // Preso da iMin = 0 (significa che solo la corsia centrale è strada)

    var sideColsLeft = 6;  // Preso da iMax = 6 (6 colonne di erba a sinistra)
    var sideColsRight = 6; // Preso da iMax = 6 (6 colonne di erba a destra)
    var totalCols = sideColsLeft + lanes + sideColsRight; // In totale 13 colonne (6 + 1 + 6)
    var minZ = -1 - sideColsLeft;
    var maxZ = 1 + sideColsRight;

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
            for (let zIndex = minZ; zIndex <= maxZ; zIndex++) {

                const isRoad = zIndex >= -1 && zIndex <= 1;
                const currentMaterial = isRoad ? materialRoad : materialSide;

                const mesh = new THREE.Mesh(geometry, currentMaterial);
                mesh.scale.set(meshSize, 1, meshSize);

                mesh.position.y = -0.5;
                mesh.position.x = (row + cumulativePosition) * meshSize;
                mesh.position.z = zIndex * meshSize;

                mesh.receiveShadow = true;

                tile.add(mesh);
            }
        }

        // 2. GENERATE LOGIC MATRIX (including side decoration columns)
        var mat = initMatrix(rows, totalCols, sideColsLeft, lanes);

        // 3. SPAWN OBJECTS
        var isFirstTile = (num === 3) && (k === 0);
        initObjects(tile, isFirstTile, mat, meshSize, cumulativePosition, totalCols, sideColsLeft);

        // Update the depth position for the next tile
        cumulativePosition += rows + 1;

        // Track the tile and add it to the scene
        activeTiles.push(tile);
        scene.add(tile);
    }
}


function randomIntFromInterval(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}


/**
 * Builds the logic matrix for one tile.
 *
 * Instead of uniform random spawning, the tile is divided into zones
 * (inspired by the Mario runner's fixed anchor rows at i=0, i=5, i=9).
 * Each zone has its own spawn logic with hazard-reward pairing.
 *
 * @param {number} rows       - Number of rows in the tile.
 * @param {number} totalCols  - Total matrix width (sides + lanes).
 * @param {number} sideColsLeft - Number of decoration columns on the left.
 * @param {number} lanes      - Number of playable lanes (3).
 * @returns {Array<Array>} The logic matrix.
 */
function initMatrix(rows, totalCols, sideColsLeft, lanes) {
    let mat = [];

    for (let i = 0; i < rows; i++) {
        mat[i] = new Array(totalCols).fill(0);
    }
    // dynamically evaluate indexes
    const startRoadJ = sideColsLeft;
    const endRoadJ = sideColsLeft + lanes - 1;
    const centerJ = sideColsLeft + Math.floor(lanes / 2);

    const rowStart = 0;
    const rowMid = Math.floor(rows / 2);
    const rowEnd = rows - 1;

    // explore the matrix
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < totalCols; j++) {

            // Determine if the current column 'j' is part of the road or the grass
            const isRoad = (j >= startRoadJ && j <= endRoadJ);

            if (isRoad) {
                // ROAD ZONE: Insert logic for the objects that are in the road (playable zone)
                if (j === centerJ) {

                    if (i === rowStart) {
                        // Spawn obstacles at the beginning of the tile 
                        // Spawn a standard box, either up (floating) or down (grounded)
                        const isUp = Math.random() >= 0.5;

                        // Assegna il tipo di cassa alla matrice
                        mat[i][j] = isUp ? "standard_box_up" : "standard_box";
                    }

                    if (i === rowMid) {
                        // Spawn obstacles in the middle of the tile 
                        // Spawn either the question block or the burubuga block (both either up or down)
                        const isQuestionBlock = Math.random() >= 0.5; // 50% probabilità
                        const isUp = Math.random() >= 0.5;           // 50% probabilità

                        if (isQuestionBlock) {
                            mat[i][j] = isUp ? "question_box_up" : "question_box";
                        } else {
                            mat[i][j] = isUp ? "burubuga_box_up" : "burubuga_box";
                        }
                    }

                    if (i === rowEnd) {
                        // Spawn obstacles at the end of the tile
                        // Spawn the nitro block (Usually always on the ground so the player must jump or dodge)
                        mat[i][j] = "nitro_box";
                    }
                }

            } else {
                // BORDERS ZONES: Insert logic for the objects that are in the borders (not playable zone)
                if (i === rowMid && j === 0) {
                    const decoration = randomIntFromInterval(1, 3)
                    let prob = 0.5;

                    switch (decoration) {
                        case 1:
                            mat[i][centerJ + 4] = "forest1";
                            break;
                        case 2:
                            mat[i][centerJ - 6] = "forest2";
                            break;
                        case 3:
                            // Left side decor
                            for (let x = 1; x < rows; x += 3) {
                                for (let y = centerJ - 6; y < centerJ; y += 3) {
                                    if (Math.random() <= prob) mat[x][y] = "random";
                                }
                            }
                            // Right side decor
                            for (let x = 1; x < rows; x += 3) {
                                for (let y = centerJ + 3; y < centerJ + 7; y += 3) {
                                    if (Math.random() <= prob) mat[x][y] = "random";
                                }
                            }
                            break;
                    }
                }
            }
        }
    }

    // Return the matrix ready to be used by initObjects
    return mat;
}


function initObjects(tile, isFirstTile, mat, meshSize, cumulativePosition, totalCols, sideColsLeft) {
    // On the very first tile, don't spawn any objects so the player has a
    // clear runway to start running.
    if (isFirstTile) return;

    const rows = mat.length;
    const cols = mat[0].length;
    const lanes = totalCols - sideColsLeft * 2; // should be 1

    // Height offset for floating ("_up") boxes — elevated above a grounded box
    const FLOAT_HEIGHT = 3;

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const cell = mat[i][j];
            if (cell === 0) continue; // empty cell

            // --- Determine if this column is part of the road ---
            const isRoad = (j >= sideColsLeft && j < sideColsLeft + lanes);

            if (isRoad) {
                // ROAD OBJECTS
                // The box / wumpa constructors expect a lane col index (0,1,2)
                // where col=1 is center (Z = 0).  With a single lane the
                // matrix road column is sideColsLeft, which we map to col = 1.
                const laneCol = 1; // center lane

                // Strip the "_up" suffix to determine the base type
                const isUp = cell.endsWith('_up');
                const baseType = isUp ? cell.replace('_up', '') : cell;

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
                    default:
                        console.warn(`[initObjects] Unknown road object type: "${cell}"`);
                        break;
                }

                if (obj) {
                    // If "_up", raise the object so it floats above the ground
                    if (isUp) {
                        obj.position.y += FLOAT_HEIGHT;
                        // Update hitbox to match the new position
                        if (obj.userData.hitbox) {
                            obj.userData.hitbox.min.y += FLOAT_HEIGHT;
                            obj.userData.hitbox.max.y += FLOAT_HEIGHT;
                        }
                    }
                    tile.add(obj);
                }

            } else {
                // SIDE DECORATION OBJECTS
                // Compute absolute world coordinates using the same zIndex
                // mapping as the ground tile placement in initTile.
                let zIndex;
                if (j < sideColsLeft) {
                    // Left side: j=0 → zIndex = -(sideColsLeft+1), j=5 → zIndex = -2
                    zIndex = j - sideColsLeft - 1;
                } else {
                    // Right side: j = sideColsLeft+lanes → zIndex = 2, ...
                    zIndex = j - sideColsLeft - lanes + 2;
                }

                const xPos = (i + cumulativePosition) * meshSize;
                const zPos = zIndex * meshSize;

                // Randomly pick one of the three decoration models
                const roll = Math.random();
                let decoration;
                if (roll < 0.33) {
                    decoration = new Cassa(xPos, zPos);
                } else if (roll < 0.66) {
                    decoration = new RockSphere(xPos, zPos);
                } else {
                    decoration = new Totem(xPos, zPos);
                }

                tile.add(decoration);
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
    // Distance behind the character before a tile gets recycled.
    const REMOVE_THRESHOLD = 200; // world units

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
            scene.remove(tile);
            activeTiles.splice(i, 1);

            // Spawn a replacement tile at the front
            initTile(scene, 1);
        }
    }
}
