/**
 * Centralised registry for all active TWEEN.Tween instances.
 *
 * Every tween created anywhere in the project should be registered here
 * via `registerTween()`. The registry automatically removes tweens when
 * they complete or are stopped so the array stays lean.
 *
 * Pause / resume / clear helpers are used by game_management.js to
 * freeze tweens on pause and nuke them on game-over.
 */

/** @type {import('three/examples/jsm/libs/tween.module.js').Tween[]} */
export const activeTweens = [];

/**
 * Register a tween and wire up automatic removal on completion and stop.
 * Returns the same tween so callers can chain: `registerTween(tw).start()`.
 *
 * @param {import('three/examples/jsm/libs/tween.module.js').Tween} tween
 * @returns {import('three/examples/jsm/libs/tween.module.js').Tween}
 */
export function registerTween(tween) {
    activeTweens.push(tween);

    // Wrap the existing onComplete (if any) so the tween is removed when done.
    const originalOnComplete = tween._onCompleteCallback;
    tween.onComplete(function (...args) {
        _removeTween(tween);
        if (originalOnComplete) originalOnComplete.apply(this, args);
    });

    // Also remove on stop (stop does NOT fire onComplete).
    const originalOnStop = tween._onStopCallback;
    tween.onStop(function (...args) {
        _removeTween(tween);
        if (originalOnStop) originalOnStop.apply(this, args);
    });

    return tween;
}

/**
 * Pause every active tween (freeze in place).
 */
export function pauseAllTweens() {
    for (const tw of activeTweens) {
        if (tw.isPlaying() && !tw.isPaused()) {
            tw.pause();
        }
    }
}

/**
 * Resume every previously paused tween.
 */
export function resumeAllTweens() {
    for (const tw of activeTweens) {
        if (tw.isPaused()) {
            tw.resume();
        }
    }
}

/**
 * Stop and remove every active tween. Used on game-over to ensure a
 * completely clean slate.
 */
export function stopAllTweens() {
    // Iterate over a copy because .stop() triggers onStop which
    // mutates the array via _removeTween.
    const copy = [...activeTweens];
    for (const tw of copy) {
        tw.stop();
    }
    activeTweens.length = 0;
}

/**
 * Stop tweens attached to a single Object3D by objects_animations.js.
 * This prevents recycled map tiles from leaving idle animations running.
 *
 * @param {THREE.Object3D} object
 */
export function stopObjectTweens(object) {
    const tweens = object?.userData?.tweens;
    if (!Array.isArray(tweens)) return;

    for (const tween of tweens) {
        tween.stop();
    }
    tweens.length = 0;
}

/* ── internal helper ─────────────────────────────────────────────── */
function _removeTween(tween) {
    const idx = activeTweens.indexOf(tween);
    if (idx !== -1) activeTweens.splice(idx, 1);
}
