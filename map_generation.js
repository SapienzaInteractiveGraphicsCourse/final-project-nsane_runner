import * as THREE from 'three';
import { WumpaFruit, NitroBox, StandardBox, BurubugaBox, NewLife, QuestionBox, Cassa, RockSphere, Totem, setWumpaModel, setGemModel, setNewLifeModel, setCassaModel, setRockSphereModel, setTotemModel } from './objects.js';
import { settings } from './settings.js';

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
 * @param {number}      cumulativePosition - Current depth offset (in grid units, along X).
 * @param {boolean}     [isFirstTile=false] - When true, no hazards/collectibles are spawned.
 * @returns {number} Updated cumulativePosition after generating all tiles.
 */
export function initTile(scene, num, cumulativePosition, isFirstTile = false) {



    // --- TILE SETTINGS ---
    // --- TILE SETTINGS (Aggiornati con i tuoi valori) ---
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
        initObjects(tile, isFirstTile, mat, meshSize, cumulativePosition, totalCols, sideColsLeft);

        // Update the depth position for the next tile
        cumulativePosition += rows + 1;

        scene.add(tile);
    }

    return cumulativePosition;
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

// function initObjects(tile, flag) {
//     let zPosition = -cumulativePosition;
//     let offset = 1;
//     if (settings.quality !== "high") {
//         zPosition = zPosition * 3;
//         offset = 2;
//     }
//     const mat = initMatrix();
//     const rows = mat.length;
//     const cols = mat[0].length;

//     for (let i = rows - 1; i >= 0; i--) {
//         for (let j = cols - 1; j >= 0; j--) {
//             const objectType = mat[i][j];
//             if (objectType === 0) continue; // Skip empty spots

//             const posX = 5 * (j - Math.floor(cols / 2));
//             const posZ = 5 * (zPosition + i + offset);

//             /* ----- MAIN ROAD HAZARDS & ITEMS ----- */
//             if (!flag) {
//                 switch (objectType) {
//                     case "spike": {
//                         const spike = new THREE.Object3D();
//                         spike.name = "spike";
//                         const object = models.spike.gltf.clone();
//                         const collisionBox = initCollisionBox();
//                         object.scale.set(8, 8, 8);
//                         collisionBox.scale.set(5, 2, 5);
//                         spike.add(object);
//                         spike.add(collisionBox);
//                         spike.position.set(posX, 0, posZ);
//                         initCollisionVertices(collisionBox);
//                         spikeAnimation(spike);
//                         tile.add(spike);
//                         break;
//                     }
//                     case "roller1": {
//                         const roller = new THREE.Object3D();
//                         roller.name = "roller";
//                         const object1 = models.roller.gltf.clone();
//                         const object2 = models.roller.gltf.clone();
//                         const collisionBox = initCollisionBox();
//                         object1.scale.set(2, 2, 2);
//                         object1.rotation.z = degToRad(90);
//                         object2.scale.set(2, 2, 2);
//                         object2.rotation.z = degToRad(-90);
//                         object2.position.x = -2;
//                         collisionBox.scale.set(14, 2.5, 2.5);

//                         const rollerGroup = new THREE.Group();
//                         rollerGroup.add(object1, object2);
//                         rollerGroup.position.x = 1;

//                         roller.add(rollerGroup, collisionBox);
//                         roller.position.set(posX, 5.5, posZ);
//                         initCollisionVertices(collisionBox);
//                         rollerHorizontalAnimation(roller);
//                         tile.add(roller);
//                         break;
//                     }
//                     case "roller2": {
//                         const roller = new THREE.Object3D();
//                         roller.name = "roller";
//                         const object = models.roller.gltf.clone();
//                         const collisionBox = initCollisionBox();
//                         object.scale.set(2, 2, 2);
//                         collisionBox.scale.set(3, 7.5, 3);
//                         collisionBox.position.y = 4;
//                         roller.add(object, collisionBox);
//                         roller.position.set(posX, 0, posZ);
//                         initCollisionVertices(collisionBox);
//                         rollerVerticalAnimation(roller);
//                         tile.add(roller);
//                         break;
//                     }
//                     case "roller3": {
//                         const roller = new THREE.Object3D();
//                         roller.name = "roller";
//                         const object1 = models.roller.gltf.clone();
//                         const object2 = models.roller.gltf.clone();
//                         const collisionBox = initCollisionBox();
//                         object1.scale.set(1.1, 1.1, 1.1);
//                         object1.rotation.z = degToRad(90);
//                         object2.scale.set(1.1, 1.1, 1.1);
//                         object2.rotation.z = degToRad(-90);
//                         object2.position.x = -1;
//                         collisionBox.scale.set(7.5, 1.3, 1.3);

//                         const rollerGroup = new THREE.Group();
//                         rollerGroup.add(object1, object2);
//                         rollerGroup.position.x = 0.5;

//                         roller.add(rollerGroup, collisionBox);
//                         roller.position.set(posX + 3, 4.7, posZ);
//                         initCollisionVertices(collisionBox);
//                         rollerHorizontalAnimation(roller);
//                         tile.add(roller);
//                         break;
//                     }
//                     case "coin":
//                     case "coinDown":
//                     case "coinUp": {
//                         const coinNumber = randomIntFromInterval(2, 4);
//                         let baseY = objectType === "coin" ? (4 * randomIntFromInterval(0, 1) + 2.5) : (objectType === "coinUp" ? 6.5 : 2);

//                         for (let y = 0; y < coinNumber; y++) {
//                             const coin = new THREE.Object3D();
//                             coin.name = "coin";
//                             const object = models.coin.gltf.clone();
//                             const collisionBox = initCollisionBox();
//                             object.scale.set(10, 10, 10);
//                             collisionBox.scale.set(1.5, 3, 3.5);
//                             collisionBox.rotation.y = degToRad(90);
//                             coin.add(object, collisionBox);
//                             coin.position.set(posX, baseY, 5 * (zPosition + i + offset - y));
//                             initCollisionVertices(collisionBox);
//                             coinAnimation(coin);
//                             tile.add(coin);
//                         }
//                         break;
//                     }
//                     case "starUp":
//                     case "starDown": {
//                         const star = new THREE.Object3D();
//                         star.name = "star";
//                         const object = models.star.gltf.clone();
//                         const collisionBox = initCollisionBox();
//                         object.scale.set(0.5, 0.5, 0.5);
//                         collisionBox.scale.set(3, 3, 1.5);
//                         star.add(object, collisionBox);
//                         star.position.set(posX, objectType === "starUp" ? 6 : 2, posZ - 3);
//                         initCollisionVertices(collisionBox);
//                         starAnimation(star);
//                         tile.add(star);
//                         break;
//                     }
//                     case "mushroom": {
//                         const yPos = randomIntFromInterval(0, 1);
//                         const mushroom = new THREE.Object3D();
//                         mushroom.name = "mushroom";
//                         const object = models.mushroom.gltf.clone();
//                         const collisionBox = initCollisionBox();
//                         object.scale.set(0.5, 0.5, 0.5);
//                         collisionBox.scale.set(2.3, 2.3, 2.3);
//                         collisionBox.position.y = 0.5;
//                         mushroom.add(object, collisionBox);
//                         mushroom.position.set(posX, 4 * yPos + 2, posZ);
//                         initCollisionVertices(collisionBox);
//                         mushroomAnimation(mushroom);
//                         tile.add(mushroom);
//                         break;
//                     }
//                 }
//             }

//             /* ----- GRASSLAND DECORATIONS ----- */
//             if (objectType === "random") {
//                 const randObj = randomIntFromInterval(1, 5);
//                 switch (randObj) {
//                     case 1: {
//                         const block = models.mystery_block.gltf.clone();
//                         block.scale.set(5, 5, 5);
//                         block.rotation.y = degToRad(randomIntFromInterval(0, 360));
//                         block.position.set(posX, 3.5, posZ); // 5 * 0.7
//                         tile.add(block); break;
//                     }
//                     case 2: {
//                         const block = models.brick_block.gltf.clone();
//                         block.scale.set(8, 8, 8);
//                         block.rotation.y = degToRad(randomIntFromInterval(0, 360));
//                         block.position.set(posX, 2, posZ); // 8 * 0.25
//                         tile.add(block); break;
//                     }
//                     case 3: {
//                         const block = models.pow_block.gltf.clone();
//                         block.scale.set(0.8, 0.8, 0.8);
//                         block.rotation.y = degToRad(randomIntFromInterval(0, 360));
//                         block.position.set(posX, -0.35, posZ);
//                         tile.add(block); break;
//                     }
//                     case 4: {
//                         const pipe = models.pipe.gltf.clone();
//                         pipe.scale.set(10, 10, 10);
//                         pipe.rotation.x = degToRad(-90);
//                         pipe.position.set(posX, 5, posZ);
//                         tile.add(pipe); break;
//                     }
//                     case 5: {
//                         const tree = models.tree.gltf.clone();
//                         tree.scale.set(0.035, 0.035, 0.035);
//                         tree.rotation.y = degToRad(randomIntFromInterval(0, 360));
//                         tree.position.set(posX, 0.5, posZ);
//                         tile.add(tree); break;
//                     }
//                 }
//             } else if (objectType === "forest1") {
//                 const forest1 = models.forest1.gltf.clone();
//                 forest1.scale.set(10, 10, 10);
//                 forest1.position.set(posX, 0, posZ);
//                 tile.add(forest1);
//             } else if (objectType === "forest2") {
//                 const forest2 = models.forest1.gltf.clone(); // Was named forest1 in original code
//                 forest2.scale.set(10, 10, 10);
//                 forest2.rotation.y = degToRad(180);
//                 forest2.position.set(posX + 10, 0, posZ);
//                 tile.add(forest2);
//             }
//         }
//     }
// }

// function initMatrix() {
//     let mat = [];
//     const jMax = settings.quality === "low" ? 11 : 13;
//     const iMax = 18;

//     // Initialize blank matrix
//     for (let i = 0; i < iMax; i++) {
//         mat[i] = new Array(jMax).fill(0);
//     }

//     for (let i = 0; i < iMax; i++) {
//         for (let j = 0; j < jMax; j++) {

//             // CENTER OF THE ROAD
//             if (j === Math.floor(jMax / 2)) {
//                 if (i === 0) {
//                     const up = Math.random();
//                     const starProbability = 0.25;

//                     if (up >= 0.5) {
//                         mat[i][j] = "roller1";
//                         if (Math.random() < starProbability && !settings.star) {
//                             const r = Math.random();
//                             if (r < 0.333) mat[i + 1][j - 1] = "starDown";
//                             else if (r < 0.666) mat[i + 1][j] = "starDown";
//                             else mat[i + 1][j + 1] = "starDown";
//                         }
//                     } else {
//                         mat[i][j - 1] = "spike";
//                         mat[i][j] = "spike";
//                         mat[i][j + 1] = "spike";

//                         if (Math.random() < starProbability && !settings.star) {
//                             const r = Math.random();
//                             if (r < 0.333) mat[i + 1][j - 1] = "starUp";
//                             else if (r < 0.666) mat[i + 1][j] = "starUp";
//                             else mat[i + 1][j + 1] = "starUp";
//                         }
//                     }
//                 }
//                 if (i === 5) {
//                     if (Math.random() < 0.25) { // mushroomProbability
//                         const r = Math.random();
//                         if (r < 0.333) mat[i][j - 1] = "mushroom";
//                         else if (r < 0.666) mat[i][j] = "mushroom";
//                         else mat[i][j + 1] = "mushroom";
//                     }
//                 }
//                 if (i === 9) {
//                     const obstacle = Math.random();
//                     const coinProbability = 0.5;

//                     if (obstacle >= 0.5) { // Roller
//                         const position = randomIntFromInterval(1, 5);
//                         switch (position) {
//                             case 1:
//                                 mat[i][j - 1] = "roller2";
//                                 if (Math.random() < coinProbability) mat[i + 1][Math.random() < 0.5 ? j : j + 1] = "coin";
//                                 break;
//                             case 2:
//                                 mat[i][j] = "roller2";
//                                 if (Math.random() < coinProbability) mat[i + 1][Math.random() < 0.5 ? j - 1 : j + 1] = "coin";
//                                 break;
//                             case 3:
//                                 mat[i][j + 1] = "roller2";
//                                 if (Math.random() < coinProbability) mat[i + 1][Math.random() < 0.5 ? j - 1 : j] = "coin";
//                                 break;
//                             case 4:
//                                 mat[i][j - 1] = "roller3";
//                                 if (Math.random() < coinProbability) {
//                                     const r = Math.random();
//                                     if (r < 0.333) mat[i + 2][j - 1] = "coinDown";
//                                     else if (r < 0.666) mat[i + 2][j] = "coinDown";
//                                     else mat[i + 2][j + 1] = "coin";
//                                 }
//                                 break;
//                             case 5:
//                                 mat[i][j] = "roller3";
//                                 if (Math.random() < coinProbability) {
//                                     const r = Math.random();
//                                     if (r < 0.333) mat[i + 2][j - 1] = "coin";
//                                     else if (r < 0.666) mat[i + 2][j] = "coinDown";
//                                     else mat[i + 2][j + 1] = "coinDown";
//                                 }
//                                 break;
//                         }
//                     } else { // Spikes
//                         const position = randomIntFromInterval(1, 3);
//                         switch (position) {
//                             case 1:
//                                 mat[i][j - 1] = mat[i][j] = "spike";
//                                 if (Math.random() < coinProbability) {
//                                     const r = Math.random();
//                                     mat[i + 1][r < 0.333 ? j - 1 : (r < 0.666 ? j : j + 1)] = r < 0.666 ? "coinUp" : "coin";
//                                 }
//                                 break;
//                             case 2:
//                                 mat[i][j] = mat[i][j + 1] = "spike";
//                                 if (Math.random() < coinProbability) {
//                                     const r = Math.random();
//                                     mat[i + 1][r < 0.333 ? j - 1 : (r < 0.666 ? j : j + 1)] = r < 0.333 ? "coin" : "coinUp";
//                                 }
//                                 break;
//                             case 3:
//                                 mat[i][j - 1] = mat[i][j + 1] = "spike";
//                                 if (Math.random() < coinProbability) {
//                                     const r = Math.random();
//                                     mat[i + 1][r < 0.333 ? j - 1 : (r < 0.666 ? j : j + 1)] = r < 0.666 && r >= 0.333 ? "coin" : "coinUp";
//                                 }
//                                 break;
//                         }
//                     }
//                 }
//             }

//             else if (i === 9 && j === 0) {
//                 const decoration = randomIntFromInterval(1, 3);
//                 const spawnProbability = settings.quality === "low" ? 0.3 : 0.5;
//                 const centerJ = Math.floor(jMax / 2);

//                 switch (decoration) {
//                     case 1:
//                         mat[i][centerJ + 4] = "forest1";
//                         break;
//                     case 2:
//                         mat[i][centerJ - 6] = "forest2";
//                         break;
//                     case 3:
//                         // Left side decor
//                         for (let x = 1; x < iMax; x += 3) {
//                             for (let y = centerJ - 6; y < centerJ; y += 3) {
//                                 if (Math.random() <= spawnProbability) mat[x][y] = "random";
//                             }
//                         }
//                         // Right side decor
//                         for (let x = 1; x < iMax; x += 3) {
//                             for (let y = centerJ + 3; y < centerJ + 7; y += 3) {
//                                 if (Math.random() <= spawnProbability) mat[x][y] = "random";
//                             }
//                         }
//                         break;
//                 }
//             }
//         }
//     }
//     return mat;
// }