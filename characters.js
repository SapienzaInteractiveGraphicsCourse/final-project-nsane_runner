import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

let _akuakuModelCache = null;

/**
 * Represents the main playable character, Crash Bandicoot.
 *
 * Encapsulates the character's state (position, movement flags, mesh, bones)
 * and exposes a `load(loader)` method to asynchronously load the GLTF model.
 */
export class Crash {
    constructor() {
        /** @type {THREE.Object3D|null} The loaded 3D mesh for this character. */
        this.mesh = null;

        /** @type {Object} Named bone references populated after model load. */
        this.bones = {};

        /** Current lane index (used for lateral movement). */
        this.currentPosition = 0;

        /** Step size (world units) for vertical movement. */
        this.verticalMovement = 5;

        /** Step size (world units) for horizontal movement. */
        this.horizontalMovement = 5;

        /** Whether the character is currently mid-jump. */
        this.isJumping = false;

        /** Whether the character is currently rotating. */
        this.isRotating = false;
    }

    /**
     * Returns the character's world position.
     * Falls back to the origin if the mesh hasn't been loaded yet.
     *
     * @returns {{ x: number, y: number, z: number }}
     */
    get position() {
        return this.mesh ? this.mesh.position : { x: 0, y: 0, z: 0 };
    }

    /**
     * Returns the character's bounding box/hitbox.
     *
     * @returns {THREE.Box3}
     */
    get_hitbox() {
        const charPos = this.position;
        return new THREE.Box3(
            new THREE.Vector3(charPos.x - 1, charPos.y, charPos.z - 1),
            new THREE.Vector3(charPos.x + 1, charPos.y + 5, charPos.z + 1)
        );
    }

    /**
     * Asynchronously loads the Crash GLTF model and assigns it to `this.mesh`.
     *
     * @param {GLTFLoader} loader - A pre-configured GLTFLoader instance.
     * @returns {Promise<THREE.Object3D>} The loaded scene root.
     */
    load(loader) {
        return new Promise((resolve, reject) => {
            loader.load('/crash/scene.gltf', (gltf) => {
                this.mesh = gltf.scene;
                resolve(this.mesh);
            }, undefined, reject);
        });
    }
}

/**
 * Represents the Aku Aku helper mask that protects Crash from one hit.
 */
export class AkuAku {
    constructor() {
        if (_akuakuModelCache) {
            this.mesh = SkeletonUtils.clone(_akuakuModelCache);
        } else {
            this.mesh = null;
        }
    }

    /**
     * Asynchronously loads the Aku Aku GLTF model and caches it.
     * Must be called at boot before instantiating AkuAku.
     *
     * @param {GLTFLoader} loader - A pre-configured GLTFLoader instance.
     * @returns {Promise<THREE.Object3D>} The loaded scene root.
     */
    static load(loader) {
        return new Promise((resolve, reject) => {
            loader.load('/akuaku/scene.gltf', (gltf) => {
                _akuakuModelCache = gltf.scene;
                resolve(_akuakuModelCache);
            }, undefined, reject);
        });
    }
}