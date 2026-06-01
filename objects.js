import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { wumpa_animation, nitro_animation, dropped_item_animation } from './objects_animations.js';

// Shared texture & material — loaded once, reused across all StandardBox instances.
const _textureLoader = new THREE.TextureLoader();
const _texture = _textureLoader.load('/textures/blocks/standard.jpg');
const _textureNitro = _textureLoader.load('/textures/blocks/nitro.jpg');
const _textureNitroUpper = _textureLoader.load('/textures/blocks/nitro_upper.jpg');
const _textureBurubuga = _textureLoader.load('/textures/blocks/burubuga.jpg');
const _textureNewLife = _textureLoader.load('/textures/blocks/newlife.png');
const _textureCrashFace = _textureLoader.load('/textures/crashFace.png');
const _textureQuestionBox = _textureLoader.load('/textures/blocks/question_block.png');

const _material = new THREE.MeshStandardMaterial({ map: _texture });
const _materialNitro = new THREE.MeshStandardMaterial({ map: _textureNitro });
const _materialNitroUpper = new THREE.MeshStandardMaterial({ map: _textureNitroUpper });
const _materialBurubuga = new THREE.MeshStandardMaterial({ map: _textureBurubuga });
const _materialNewLife = new THREE.MeshStandardMaterial({ map: _textureNewLife });
const _materialCrashFace = new THREE.MeshStandardMaterial({ map: _textureCrashFace });
const _materialQuestionBox = new THREE.MeshStandardMaterial({ map: _textureQuestionBox });

const _materialsNitro = [
    _materialNitro,       // 0
    _materialNitro,       // 1
    _materialNitroUpper,  // 2 -> upper face
    _materialNitro,       // 3
    _materialNitro,       // 4
    _materialNitro,       // 5
];

const _materialsBurubuga = [
    _materialBurubuga,       // 0
    _materialBurubuga,       // 1
    _material,               // 2
    _materialBurubuga,       // 3
    _materialBurubuga,       // 4
    _material,               // 5
]

const _materialsQuestionBox = [
    _materialQuestionBox,       // 0
    _materialQuestionBox,       // 1
    _materialQuestionBox,       // 2
    _materialQuestionBox,       // 3
    _materialQuestionBox,       // 4
    _materialQuestionBox,       // 5
]

const _materialsNewLife = [
    _materialNewLife,       // 0
    _materialNewLife,       // 1
    _materialNewLife,       // 2
    _materialNewLife,       // 3
    _materialNewLife,       // 4
    _materialNewLife,       // 5
]

// Wumpa model scene — set externally via setWumpaModel() before calling initTile.
let _wumpaModelCache = null;

// Gem model scene — set externally via setGemModel() before spawning gems.
let _gemModelCache = null;

// New Life model scene — set externally via setNewLifeModel() before spawning dropped lives.
let _newLifeModelCache = null;

// Cassa model scene — set externally via setCassaModel() before spawning cassas.
let _cassaModelCache = null;

// Rock Sphere model scene — set externally via setRockSphereModel() before spawning rock spheres.
let _rockSphereModelCache = null;

// Totem model scene — set externally via setTotemModel() before spawning totems.
let _totemModelCache = null;


// --- BOX SIZE CONSTANTS ---
// All boxes use the same world-unit size (2×2×2) so they fit comfortably
// inside a 5-unit lane cell without overlapping neighbouring cells.
const BOX_SIZE = 2;
const BOX_HALF = BOX_SIZE / 2;

/**
 * Helper: compute world position and hitbox for a grid-placed box.
 * Shared by StandardBox, NitroBox, and BurubugaBox.
 */
function _placeBox(mesh, meshSize, row, col, cumulativePosition) {
    // Forward axis: X  (same formula as WumpaFruit)
    mesh.position.x = (row + cumulativePosition) * meshSize;
    // Lane axis: Z  (col 0,1,2 → lanes -1,0,1)
    mesh.position.z = (col - 1) * meshSize;
    // Sit on top of the ground (ground surface is at y = 0)
    mesh.position.y = BOX_HALF;

    // Axis-aligned hitbox for collision detection
    mesh.userData.hitbox = new THREE.Box3(
        new THREE.Vector3(
            mesh.position.x - BOX_HALF,
            mesh.position.y - BOX_HALF,
            mesh.position.z - BOX_HALF
        ),
        new THREE.Vector3(
            mesh.position.x + BOX_HALF,
            mesh.position.y + BOX_HALF,
            mesh.position.z + BOX_HALF
        )
    );
}

/**
 * A textured cube with `standard.jpg` applied to all six faces.
 *
 * Extends THREE.Mesh so it can be added directly to any Object3D / scene:
 *   tile.add(new StandardBox(meshSize, row, col, cumulativePosition));
 *
 * The texture and material are shared (created once at module load time)
 * to avoid redundant GPU uploads across instances.
 *
 * @extends THREE.Mesh
 */
export class StandardBox extends THREE.Mesh {

    /**
     * @param {number} meshSize           - World-space size of one grid cell.
     * @param {number} row                - Row index within the current tile.
     * @param {number} col                - Column index (0 = left, 1 = center, 2 = right).
     * @param {number} cumulativePosition - Tile depth offset along the X axis (in grid units).
     */
    constructor(meshSize, row, col, cumulativePosition) {
        const geometry = new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE);
        super(geometry, _material);

        this.name = 'standard_box';
        this.castShadow = true;
        this.receiveShadow = true;

        _placeBox(this, meshSize, row, col, cumulativePosition);
    }
}

/**
 * A nitro crate with `nitro.jpg` on the five side/bottom faces
 * and `nitro_upper.jpg` on the top (+Y) face.
 *
 * @extends THREE.Mesh
 */
export class NitroBox extends THREE.Mesh {
    constructor(meshSize, row, col, cumulativePosition) {
        const geometry = new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE);
        super(geometry, _materialsNitro);

        this.name = 'nitro_box';
        this.castShadow = true;
        this.receiveShadow = true;

        _placeBox(this, meshSize, row, col, cumulativePosition);
        nitro_animation(this);
    }

}

/**
 * A burubuga crate with mixed `burubuga.jpg` / `standard.jpg` faces.
 *
 * @extends THREE.Mesh
 */
export class BurubugaBox extends THREE.Mesh {
    constructor(meshSize, row, col, cumulativePosition) {
        const geometry = new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE);
        super(geometry, _materialsBurubuga);

        this.name = 'burubuga_box';
        this.castShadow = true;
        this.receiveShadow = true;

        _placeBox(this, meshSize, row, col, cumulativePosition);
    }
}

export class QuestionBox extends THREE.Mesh {
    constructor(meshSize, row, col, cumulativePosition) {
        const geometry = new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE);
        super(geometry, _materialsQuestionBox);

        this.name = 'question_box';
        this.castShadow = true;
        this.receiveShadow = true;

        _placeBox(this, meshSize, row, col, cumulativePosition);
    }
}


export class NewLife extends THREE.Mesh {
    constructor(meshSize, row, col, cumulativePosition) {
        const geometry = new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE);
        super(geometry, _materialsNewLife);

        this.name = 'new_life';
        this.castShadow = true;
        this.receiveShadow = true;

        _placeBox(this, meshSize, row, col, cumulativePosition);
    }
}


/**
 * Injects the pre-loaded wumpa GLTF scene so WumpaFruit instances can clone it.
 * Must be called before the first WumpaFruit is constructed.
 *
 * @param {THREE.Object3D} model - The root scene from the wumpa GLTF.
 */
export function setWumpaModel(model) {
    _wumpaModelCache = model;
}

/**
 * Injects the pre-loaded gem GLTF scene so DroppedGem instances can clone it.
 * Must be called before the first DroppedGem is constructed.
 *
 * @param {THREE.Object3D} model - The root scene from the gem GLTF.
 */
export function setGemModel(model) {
    _gemModelCache = model;
}

/**
 * Injects the pre-loaded newlife GLTF scene so DroppedLife instances can clone it.
 * Must be called before the first DroppedLife is constructed.
 *
 * @param {THREE.Object3D} model - The root scene from the newlife GLTF.
 */
export function setNewLifeModel(model) {
    _newLifeModelCache = model;
}

/**
 * Injects the pre-loaded cassa GLTF scene so Cassa instances can clone it.
 * Must be called before the first Cassa is constructed.
 *
 * @param {THREE.Object3D} model - The root scene from the cassa GLTF.
 */
export function setCassaModel(model) {
    _cassaModelCache = model;
}

/**
 * Injects the pre-loaded rock sphere GLTF scene so RockSphere instances can clone it.
 * Must be called before the first RockSphere is constructed.
 *
 * @param {THREE.Object3D} model - The root scene from the rock sphere GLTF.
 */
export function setRockSphereModel(model) {
    _rockSphereModelCache = model;
}

/**
 * Injects the pre-loaded totem GLTF scene so Totem instances can clone it.
 * Must be called before the first Totem is constructed.
 *
 * @param {THREE.Object3D} model - The root scene from the totem GLTF.
 */
export function setTotemModel(model) {
    _totemModelCache = model;
}

/**
 * A single Wumpa fruit placed in the world.
 *
 * Extends THREE.Object3D so it can be added directly to a tile group:
 *   tile.add(new WumpaFruit(meshSize, row, col, cumulativePosition));
 *
 * The instance is named "wumpa_fruit" so collision detection in main.js can
 * identify it by traversing the scene graph.
 *
 * @extends THREE.Object3D
 */
export class WumpaFruit extends THREE.Object3D {

    /**
     * @param {number} meshSize           - World-space size of one grid cell.
     * @param {number} row                - Row index within the current tile.
     * @param {number} col                - Column index (0 = left, 1 = center, 2 = right).
     * @param {number} cumulativePosition - Tile depth offset along the X axis (in grid units).
     */
    constructor(meshSize, row, col, cumulativePosition) {
        super();

        this.name = 'wumpa_fruit';

        // Clone the pre-loaded wumpa GLTF model.
        // SkeletonUtils.clone() is used instead of .clone() to correctly
        // preserve material groups and texture bindings on GLTF scenes.
        const object = SkeletonUtils.clone(_wumpaModelCache);
        object.scale.set(0.3, 0.3, 0.3);
        this.add(object);

        // Forward axis: X  (row offset within this tile)
        this.position.x = (row + cumulativePosition) * meshSize;
        // Lane axis: Z  (col → 0,1,2 mapped to -1,0,1)
        this.position.z = (col - 1) * meshSize;
        this.position.y = 1.5; // Height above ground

        // Hitbox: axis-aligned box centred on the wumpa's world position.
        // Half-extents are intentionally tight (1.2 units) so collection
        // feels precise but not frustrating. Queried each frame in main.js.
        const halfSize = 1.2;
        this.userData.hitbox = new THREE.Box3(
            new THREE.Vector3(
                this.position.x - halfSize,
                this.position.y - halfSize,
                this.position.z - halfSize
            ),
            new THREE.Vector3(
                this.position.x + halfSize,
                this.position.y + halfSize,
                this.position.z + halfSize
            )
        );

        // Start the idle animation immediately — every wumpa spins and bobs
        // from the moment it is created, no external call required.
        wumpa_animation(this);
    }
}


/**
 * A wumpa fruit spawned at an absolute world position (not grid-based).
 * Used when a standard box is broken — the wumpa drops in front of the
 * character and can be collected by the existing wumpa collision system
 * because it is named 'wumpa_fruit'.
 *
 * @extends THREE.Object3D
 */
export class DroppedWumpa extends THREE.Object3D {

    /**
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     * @param {number} z - World Z position.
     */
    constructor(x, y, z) {
        super();

        this.name = 'wumpa_fruit';

        const object = SkeletonUtils.clone(_wumpaModelCache);
        object.scale.set(0.3, 0.3, 0.3);
        this.add(object);

        this.position.set(x, y, z);

        // Tight hitbox identical to the grid-based WumpaFruit
        const halfSize = 1.2;
        this.userData.hitbox = new THREE.Box3(
            new THREE.Vector3(x - halfSize, y - halfSize, z - halfSize),
            new THREE.Vector3(x + halfSize, y + halfSize, z + halfSize)
        );

        // Spawn with a small upward arc then idle spin+bob
        dropped_item_animation(this);
    }
}


/**
 * A 1-Up drop spawned at an absolute world position when a new_life box
 * is broken. Rendered using the newlife.glb GLTF model.
 * Named 'dropped_life' — collected via dedicated collision logic.
 *
 * @extends THREE.Object3D
 */
export class DroppedLife extends THREE.Object3D {

    /**
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     * @param {number} z - World Z position.
     */
    constructor(x, y, z) {
        super();

        this.name = 'dropped_life';

        const object = SkeletonUtils.clone(_newLifeModelCache);
        object.scale.set(1.5, 1.5, 1.5);
        object.rotateY(Math.PI / 2);
        this.add(object);

        this.position.set(x, y, z);


        // Tight hitbox for collection
        const halfSize = 1.2;
        this.userData.hitbox = new THREE.Box3(
            new THREE.Vector3(x - halfSize, y - halfSize, z - halfSize),
            new THREE.Vector3(x + halfSize, y + halfSize, z + halfSize)
        );

        // Same upward arc + idle spin+bob as other dropped items
        dropped_item_animation(this);
    }
}


/**
 * A gem drop spawned at an absolute world position when a question_box
 * is broken and the random roll selects a gem.
 * Uses the pre-loaded gem GLTF model (set via setGemModel()).
 * Named 'dropped_gem' — collected via dedicated collision logic.
 *
 * @extends THREE.Object3D
 */
export class DroppedGem extends THREE.Object3D {

    /**
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     * @param {number} z - World Z position.
     */
    constructor(x, y, z) {
        super();

        this.name = 'dropped_gem';

        const object = SkeletonUtils.clone(_gemModelCache);
        object.scale.set(1.8, 1.8, 1.8);
        this.add(object);

        this.position.set(x, y, z);

        // Tight hitbox for collection
        const halfSize = 1.2;
        this.userData.hitbox = new THREE.Box3(
            new THREE.Vector3(x - halfSize, y - halfSize, z - halfSize),
            new THREE.Vector3(x + halfSize, y + halfSize, z + halfSize)
        );

        // Same upward arc + idle spin+bob as other dropped items
        dropped_item_animation(this);
    }
}


/**
 * A decorative cassa (wooden crate) placed on the side strips of the map.
 * Uses absolute world coordinates (xPos, zPos) because it lives outside the
 * playable grid and does not participate in collision detection.
 *
 * @extends THREE.Object3D
 */
export class Cassa extends THREE.Object3D {

    /**
     * @param {number} xPos - Absolute world X position.
     * @param {number} zPos - Absolute world Z position.
     */
    constructor(xPos, zPos) {
        super();

        this.name = 'cassa';

        // Clone the pre-loaded cassa GLTF model.
        // SkeletonUtils.clone() correctly preserves material groups and
        // texture bindings on GLTF scenes (unlike a plain .clone()).
        const object = SkeletonUtils.clone(_cassaModelCache);
        object.scale.set(0.03, 0.03, 0.03);
        object.rotation.y = Math.random() * Math.PI * 2;

        // Snap the model's base to Y = 0 regardless of where the GLTF origin sits.
        const box = new THREE.Box3().setFromObject(object);
        object.position.y -= box.min.y;

        this.add(object);

        // Place directly at the computed world position.
        this.position.set(xPos, 0, zPos);
    }
}


/**
 * A decorative rock sphere placed on the side strips of the map.
 * Uses absolute world coordinates (xPos, zPos) — purely decorative,
 * no hitbox or collision logic.
 *
 * @extends THREE.Object3D
 */
export class RockSphere extends THREE.Object3D {

    /**
     * @param {number} xPos - Absolute world X position.
     * @param {number} zPos - Absolute world Z position.
     */
    constructor(xPos, zPos) {
        super();

        this.name = 'rock_sphere';

        const object = SkeletonUtils.clone(_rockSphereModelCache);
        object.scale.set(3, 3, 3);
        object.rotation.y = Math.random() * Math.PI * 2;

        // The GLTF origin may not sit at the model's base, so we compute the
        // axis-aligned bounding box after scaling and shift the model down by
        // its minimum Y — this snaps the bottom of the mesh to Y = 0 (ground).
        const box = new THREE.Box3().setFromObject(object);
        object.position.y -= box.min.y;

        this.add(object);

        this.position.set(xPos, 0, zPos);
    }
}


/**
 * A decorative totem placed on the side strips of the map.
 * Uses absolute world coordinates (xPos, zPos) — purely decorative,
 * no hitbox or collision logic.
 *
 * @extends THREE.Object3D
 */
export class Totem extends THREE.Object3D {

    /**
     * @param {number} xPos - Absolute world X position.
     * @param {number} zPos - Absolute world Z position.
     */
    constructor(xPos, zPos) {
        super();

        this.name = 'totem';

        const object = SkeletonUtils.clone(_totemModelCache);
        object.scale.set(4, 4, 4);
        const box = new THREE.Box3().setFromObject(object);
        object.position.y -= box.min.y;

        this.add(object);

        this.position.set(xPos, 0, zPos);
    }
}