import TWEEN from 'three/examples/jsm/libs/tween.module.js';
import { registerTween } from './tween_registry.js';

/**
 * Attaches a looping idle animation to a WumpaFruit Object3D:
 *   • Continuous full-spin on the Y axis
 *   • Gentle bob up and back down (chained, repeating)
 *
 * @param {THREE.Object3D} wumpa - The WumpaFruit instance to animate.
 */
export function wumpa_animation(wumpa) {

    const BASE_Y = wumpa.position.y;   // original resting height
    const BOB_HEIGHT = 0.6;                // how many units it rises
    const BOB_DURATION = 600;                // ms for each half of the bob
    const SPIN_DURATION = 3000;              // ms for a full 360° rotation

    // ── 1. CONTINUOUS SPIN ─────────────────────────────────────────────
    // Tween the Y rotation from 0 → 2π, then repeat forever.
    const rotation = { y: 0 };

    const spinTween = new TWEEN.Tween(rotation)
        .to({ y: Math.PI * 2 }, SPIN_DURATION)
        .easing(TWEEN.Easing.Linear.None)
        .onUpdate(() => {
            wumpa.rotation.y = rotation.y;
        })
        .repeat(Infinity);

    registerTween(spinTween);
    spinTween.start();

    // ── 2. BOB (up → down, chained) ────────────────────────────────────
    // Rise tween — Quadratic.Out makes it decelerate as it peaks.
    const bobUp = new TWEEN.Tween(wumpa.position)
        .to({ y: BASE_Y + BOB_HEIGHT }, BOB_DURATION)
        .easing(TWEEN.Easing.Quadratic.Out);

    // Fall tween — Quadratic.In makes it accelerate back down.
    const bobDown = new TWEEN.Tween(wumpa.position)
        .to({ y: BASE_Y }, BOB_DURATION)
        .easing(TWEEN.Easing.Quadratic.In);

    // Chain them so each triggers the next indefinitely.
    bobUp.chain(bobDown);
    bobDown.chain(bobUp);

    registerTween(bobUp);
    registerTween(bobDown);
    bobUp.start();
}

/**
 * Sequential idle animation for Standard / Burubuga boxes:
 *   1. Small hop (up → down)
 *   2. Rotate 30° right, return to centre
 *   3. Rotate 30° left,  return to centre
 *   → Loops forever.
 *
 * A proxy object is used for the Y-rotation so TWEEN can drive
 * both box.position and box.rotation without targeting the same
 * property object twice.
 *
 * @param {THREE.Mesh} box
 */
export function nitro_animation(box) {

    const BASE_Y = box.position.y;
    const JUMP_HEIGHT = 0.5;              // units the box rises
    const JUMP_DUR = 280;              // ms per jump half
    const ROT_ANGLE = Math.PI / 6;     // 30° in radians
    const ROT_DUR = 260;             // ms per rotation half

    // Proxy so we can tween rotation independently of position
    const rot = { y: 0 };

    // ── STEP 1 — Jump up ──────────────────────────────────────────────
    const jumpUp = new TWEEN.Tween(box.position)
        .to({ y: BASE_Y + JUMP_HEIGHT }, JUMP_DUR)
        .easing(TWEEN.Easing.Quadratic.Out);

    // ── STEP 2 — Land ─────────────────────────────────────────────────
    const jumpDown = new TWEEN.Tween(box.position)
        .to({ y: BASE_Y }, JUMP_DUR)
        .easing(TWEEN.Easing.Quadratic.In);

    // ── STEP 3 — Rotate right ─────────────────────────────────────────
    const rotRight = new TWEEN.Tween(rot)
        .to({ y: ROT_ANGLE }, ROT_DUR)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate(() => { box.rotation.y = rot.y; });

    // ── STEP 4 — Return to centre ─────────────────────────────────────
    const rotRightBack = new TWEEN.Tween(rot)
        .to({ y: 0 }, ROT_DUR)
        .easing(TWEEN.Easing.Quadratic.In)
        .onUpdate(() => { box.rotation.y = rot.y; });

    // ── STEP 5 — Rotate left ──────────────────────────────────────────
    const rotLeft = new TWEEN.Tween(rot)
        .to({ y: -ROT_ANGLE }, ROT_DUR)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate(() => { box.rotation.y = rot.y; });

    // ── STEP 6 — Return to centre, then loop ─────────────────────────
    const rotLeftBack = new TWEEN.Tween(rot)
        .to({ y: 0 }, ROT_DUR)
        .easing(TWEEN.Easing.Quadratic.In)
        .onUpdate(() => { box.rotation.y = rot.y; })
        .onComplete(() => {
            // Restart the whole sequence from the top
            jumpUp.start();
        });

    // Wire up the chain
    jumpUp.chain(jumpDown);
    jumpDown.chain(rotRight);
    rotRight.chain(rotRightBack);
    rotRightBack.chain(rotLeft);
    rotLeft.chain(rotLeftBack);
    // rotLeftBack restarts via onComplete ↑

    registerTween(jumpUp);
    registerTween(jumpDown);
    registerTween(rotRight);
    registerTween(rotRightBack);
    registerTween(rotLeft);
    registerTween(rotLeftBack);
    jumpUp.start();
}


/**
 * Animation for items dropped by broken boxes (wumpa / 1-up):
 *   1. Quick upward pop (simulates the item bursting out of the box).
 *   2. Settles into the standard spin + bob idle loop.
 *
 * @param {THREE.Object3D} item - The dropped item to animate.
 */
export function dropped_item_animation(item) {

    const BASE_Y    = item.position.y;
    const POP_HEIGHT = 2.5;              // how high the item pops out
    const POP_UP_DUR = 300;              // ms for upward arc
    const POP_DOWN_DUR = 350;            // ms for landing
    const BOB_HEIGHT = 0.6;
    const BOB_DURATION = 600;
    const SPIN_DURATION = 3000;

    // ── 1. POP UP ──────────────────────────────────────────────────────
    const popUp = new TWEEN.Tween(item.position)
        .to({ y: BASE_Y + POP_HEIGHT }, POP_UP_DUR)
        .easing(TWEEN.Easing.Quadratic.Out);

    // ── 2. POP DOWN (land at resting height) ───────────────────────────
    const popDown = new TWEEN.Tween(item.position)
        .to({ y: BASE_Y }, POP_DOWN_DUR)
        .easing(TWEEN.Easing.Bounce.Out)
        .onComplete(() => {
            // ── 3. CONTINUOUS SPIN ─────────────────────────────────────
            const rotation = { y: 0 };
            const itemSpinTween = new TWEEN.Tween(rotation)
                .to({ y: Math.PI * 2 }, SPIN_DURATION)
                .easing(TWEEN.Easing.Linear.None)
                .onUpdate(() => { item.rotation.y = rotation.y; })
                .repeat(Infinity);

            registerTween(itemSpinTween);
            itemSpinTween.start();

            // ── 4. IDLE BOB ────────────────────────────────────────────
            const bobUp = new TWEEN.Tween(item.position)
                .to({ y: BASE_Y + BOB_HEIGHT }, BOB_DURATION)
                .easing(TWEEN.Easing.Quadratic.Out);

            const bobDown = new TWEEN.Tween(item.position)
                .to({ y: BASE_Y }, BOB_DURATION)
                .easing(TWEEN.Easing.Quadratic.In);

            bobUp.chain(bobDown);
            bobDown.chain(bobUp);
            registerTween(bobUp);
            registerTween(bobDown);
            bobUp.start();
        });

    registerTween(popUp);
    registerTween(popDown);
    popUp.chain(popDown);
    popUp.start();
}


export function startup_akuaku_animation(akuaku) {

    const TILT_ANGLE = Math.PI / 7.2; // ~25 degrees
    const TILT_DUR = 350;            // ms per tilt step
    const SPIN_DUR = 600;            // ms for the 180° flip
    const WAIT_STARTUP = 200;        // ms to wait before starting the animation

    // Proxy object — keeps TWEEN from colliding with Three.js internal state.
    // Start from the mesh's current Y rotation (set by the parenting code).
    const rot = { y: akuaku.rotation.y };
    const BASE_Y = akuaku.rotation.y;
    // at the beginning "sleep" the animation for a bit (1500ms)
    const sleep = new TWEEN.Tween(rot)
        .to({ y: BASE_Y }, WAIT_STARTUP)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate(() => { akuaku.rotation.y = rot.y; });
    // ── STEP 1 — Tilt 25° left ────────────────────────────────────────
    const tiltLeft = new TWEEN.Tween(rot)
        .to({ y: BASE_Y - TILT_ANGLE }, TILT_DUR)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate(() => { akuaku.rotation.y = rot.y; });

    // ── STEP 1b — Return to default ───────────────────────────────────
    const tiltLeftBack = new TWEEN.Tween(rot)
        .to({ y: BASE_Y }, TILT_DUR)
        .easing(TWEEN.Easing.Quadratic.In)
        .onUpdate(() => { akuaku.rotation.y = rot.y; });

    // ── STEP 2 — Tilt 25° right ───────────────────────────────────────
    const tiltRight = new TWEEN.Tween(rot)
        .to({ y: BASE_Y + TILT_ANGLE }, TILT_DUR)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate(() => { akuaku.rotation.y = rot.y; });

    // ── STEP 2b — Return to default ───────────────────────────────────
    const tiltRightBack = new TWEEN.Tween(rot)
        .to({ y: BASE_Y }, TILT_DUR)
        .easing(TWEEN.Easing.Quadratic.In)
        .onUpdate(() => { akuaku.rotation.y = rot.y; });

    // ── STEP 3 — Spin 180° (full greeting flip) ───────────────────────
    const spinAround = new TWEEN.Tween(rot)
        .to({ y: BASE_Y + Math.PI }, SPIN_DUR)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(() => { akuaku.rotation.y = rot.y; })
        .onComplete(() => {
        });

    // ── CHAIN & FIRE ──────────────────────────────────────────────────
    sleep.chain(tiltLeft);
    tiltLeft.chain(tiltLeftBack);
    tiltLeftBack.chain(tiltRight);
    tiltRight.chain(tiltRightBack);
    tiltRightBack.chain(spinAround);
    registerTween(sleep);
    registerTween(tiltLeft);
    registerTween(tiltLeftBack);
    registerTween(tiltRight);
    registerTween(tiltRightBack);
    registerTween(spinAround);
    sleep.start();
}

