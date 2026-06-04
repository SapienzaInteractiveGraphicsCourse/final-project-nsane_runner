import TWEEN from 'three/examples/jsm/libs/tween.module.js';
import * as THREE from 'three';
import { settings } from './settings.js';
import { removeTiles } from './map_generation.js';
import { Sound } from './sounds.js';

const spinSound = new Sound('spinSound.wav');

// Array to store active movement tweens so they can be stopped if necessary
export var characterMovingAnimationTweens = [];

// =========================================================================
//  CANONICAL REST POSE — captured once from the model's original bone state
// =========================================================================

/**
 * Captures the model's original bone rotations/positions as the canonical
 * rest pose. Must be called exactly once, before any animation starts.
 * Stores the result on `character._canonicalRestPose`.
 */
function captureCanonicalRestPose(character) {
    if (character._canonicalRestPose) return; // already captured

    const mesh = character.mesh;
    const get = (name) => mesh.getObjectByName(name);

    const leftLeg1  = get("leg1_45");
    const leftLeg2  = get("leg2_44");
    const leftFoot  = get("foot_43");
    const leftToe   = get("toe_42");
    const rightLeg1 = get("leg1001_49");
    const rightLeg2 = get("leg2001_48");
    const rightFoot = get("foot001_47");
    const rightToe  = get("toe001_46");
    const leftArm1  = get("arm1_27");
    const leftArm2  = get("arm2_26");
    const rightArm1 = get("arm1001_40");
    const rightArm2 = get("arm2001_39");
    const body      = get("body_41");
    const rootJoint = get("GLTF_created_0_rootJoint");

    character._canonicalRestPose = {
        lL1: leftLeg1  ? leftLeg1.rotation.clone()  : null,
        lL2: leftLeg2  ? leftLeg2.rotation.clone()  : null,
        lF:  leftFoot  ? leftFoot.rotation.clone()  : null,
        lT:  leftToe   ? leftToe.rotation.clone()   : null,
        rL1: rightLeg1 ? rightLeg1.rotation.clone() : null,
        rL2: rightLeg2 ? rightLeg2.rotation.clone() : null,
        rF:  rightFoot ? rightFoot.rotation.clone() : null,
        rT:  rightToe  ? rightToe.rotation.clone()  : null,
        lA1: leftArm1  ? leftArm1.rotation.clone()  : null,
        lA2: leftArm2  ? leftArm2.rotation.clone()  : null,
        rA1: rightArm1 ? rightArm1.rotation.clone() : null,
        rA2: rightArm2 ? rightArm2.rotation.clone() : null,
        bodyPosY: body      ? body.position.y       : 0,
        rootY:    rootJoint ? rootJoint.rotation.y   : 0,
    };
}

/**
 * Resets every animated bone back to the canonical rest pose.
 * Safe to call at any time — idempotent.
 */
function resetToCanonicalPose(character) {
    const rest = character._canonicalRestPose;
    if (!rest) return;

    const mesh = character.mesh;
    const get = (name) => mesh.getObjectByName(name);

    const leftLeg1  = get("leg1_45");
    const leftLeg2  = get("leg2_44");
    const leftFoot  = get("foot_43");
    const leftToe   = get("toe_42");
    const rightLeg1 = get("leg1001_49");
    const rightLeg2 = get("leg2001_48");
    const rightFoot = get("foot001_47");
    const rightToe  = get("toe001_46");
    const leftArm1  = get("arm1_27");
    const leftArm2  = get("arm2_26");
    const rightArm1 = get("arm1001_40");
    const rightArm2 = get("arm2001_39");
    const body      = get("body_41");
    const rootJoint = get("GLTF_created_0_rootJoint");

    if (leftLeg1)  leftLeg1.rotation.copy(rest.lL1);
    if (leftLeg2)  leftLeg2.rotation.copy(rest.lL2);
    if (leftFoot)  leftFoot.rotation.copy(rest.lF);
    if (leftToe)   leftToe.rotation.copy(rest.lT);
    if (rightLeg1) rightLeg1.rotation.copy(rest.rL1);
    if (rightLeg2) rightLeg2.rotation.copy(rest.rL2);
    if (rightFoot) rightFoot.rotation.copy(rest.rF);
    if (rightToe)  rightToe.rotation.copy(rest.rT);
    if (leftArm1)  leftArm1.rotation.copy(rest.lA1);
    if (leftArm2)  leftArm2.rotation.copy(rest.lA2);
    if (rightArm1) rightArm1.rotation.copy(rest.rA1);
    if (rightArm2) rightArm2.rotation.copy(rest.rA2);
    if (body)      body.position.y = rest.bodyPosY;
    if (rootJoint) rootJoint.rotation.y = rest.rootY;
}

export function getCharacterSpeed() {
    return settings.currentSpeed;
}

export var characterSpeed = settings.baseSpeed;

const SEGMENT_LEN = 500; // world-units per tween segment

export function moveCharacterForward(character, scene, camera) {

    function scheduleSegment() {
        const startX = character.mesh ? character.mesh.position.x : character.position.x;
        const speed = settings.getSpeed(startX);   // dynamic!
        // const speed = 100;
        const duration = (SEGMENT_LEN / speed) * 1000; // ms

        const bodyPosition = { x: startX };

        const segmentTween = new TWEEN.Tween(bodyPosition)
            .to({ x: startX + SEGMENT_LEN }, duration)
            .easing(TWEEN.Easing.Linear.None)
            .onUpdate(function () {
                if (character.mesh) {
                    character.mesh.position.x = bodyPosition.x;
                    settings.distanceTravelled = bodyPosition.x;
                }
                removeTiles(scene)
            })

            .onComplete(function () {
                scheduleSegment();
            })
            .start();

        characterMovingAnimationTweens.push(segmentTween);
    }

    scheduleSegment();

    characterWalkAnimation(character);
}


export function characterWalkAnimation(character) {
    // --- Capture the canonical rest pose exactly once (first call only) ---
    captureCanonicalRestPose(character);

    // --- Stop & clean up any previous walk tweens ---
    if (character.walkTween) {
        character.walkTween.stop();
        const idx1 = characterMovingAnimationTweens.indexOf(character.walkTween);
        if (idx1 !== -1) characterMovingAnimationTweens.splice(idx1, 1);
        character.walkTween = null;
    }
    if (character.armWalkTween) {
        character.armWalkTween.stop();
        const idx2 = characterMovingAnimationTweens.indexOf(character.armWalkTween);
        if (idx2 !== -1) characterMovingAnimationTweens.splice(idx2, 1);
        character.armWalkTween = null;
    }

    // --- Reset all bones to the canonical rest pose before starting ---
    resetToCanonicalPose(character);

    const leftLeg1 = character.mesh.getObjectByName("leg1_45");
    const leftLeg2 = character.mesh.getObjectByName("leg2_44");
    const leftFoot = character.mesh.getObjectByName("foot_43");      // left foot
    const leftToe = character.mesh.getObjectByName("toe_42");       // left toes
    const rightLeg1 = character.mesh.getObjectByName("leg1001_49");   // right upper leg (hip)
    const rightLeg2 = character.mesh.getObjectByName("leg2001_48");   // right lower leg (calf/knee)
    const rightFoot = character.mesh.getObjectByName("foot001_47");   // right foot
    const rightToe = character.mesh.getObjectByName("toe001_46");    // right toes

    // --- Upper body ---
    const leftArm1 = character.mesh.getObjectByName("arm1_27");      // left upper arm (shoulder)
    const leftArm2 = character.mesh.getObjectByName("arm2_26");      // left forearm (elbow)
    const rightArm1 = character.mesh.getObjectByName("arm1001_40");   // right upper arm (shoulder)
    const rightArm2 = character.mesh.getObjectByName("arm2001_39");   // right forearm (elbow)

    // --- Torso / core ---
    const body = character.mesh.getObjectByName("body_41");      // upper body / spine

    // =========================================================================
    //  USE CANONICAL REST POSE (always the true original, never a mid-anim snapshot)
    // =========================================================================
    const rest = character._canonicalRestPose;

    // =========================================================================
    //  ANIMATION PARAMETERS
    // =========================================================================
    const cycleTime = 550;  // ms per full stride cycle — fast but readable

    // --- Leg amplitudes (radians) ---
    const hipSwing = 0.7;   // upper-leg forward/back swing
    const kneeFlexMax = 0.75;  // max calf bend when knee is lifted
    const kneeFlexMin = 0.1;   // slight residual bend on the planted leg
    const footRock = 0.25;  // ankle push-off articulation
    const toeFlick = 0.2;   // toe spring at push-off

    // --- Arm amplitudes (radians) ---
    const shoulderSwing = 0.55;  // upper-arm forward/back drive
    const elbowFlexMax = 0.7;   // acute elbow bend on the forward arm
    const elbowFlexMin = 0.05;  // near-straight on the trailing arm

    // --- Body dynamics ---
    const bodyBounce = 0.15;  // subtle vertical bounce amplitude (Y translation)

    // =========================================================================
    //  TWEEN 1 — LOWER BODY (Legs + Body Bounce)
    // =========================================================================
    const legCycle = { phase: 0 };

    const legTween = new TWEEN.Tween(legCycle)
        .to({ phase: Math.PI * 2 }, cycleTime)
        .easing(TWEEN.Easing.Linear.None)
        .onUpdate(function () {
            const p = legCycle.phase;

            // Sine values: left leg leads, right leg is π out of phase
            const sinL = Math.sin(p);
            const sinR = Math.sin(p + Math.PI);

            // --- UPPER LEGS (hip drive) ---
            if (leftLeg1) leftLeg1.rotation.x = rest.lL1.x + sinL * hipSwing;
            if (rightLeg1) rightLeg1.rotation.x = rest.rL1.x + sinR * hipSwing;

            // --- LOWER LEGS (knee flex) ---
            // Smooth blend: use clamped positive sine for gradual knee bend
            const leftKnee = Math.max(0, sinL);   // 0 when planted, 0→1 when lifting
            const rightKnee = Math.max(0, sinR);
            const leftKneeFlex = kneeFlexMin + (kneeFlexMax - kneeFlexMin) * leftKnee;
            const rightKneeFlex = kneeFlexMin + (kneeFlexMax - kneeFlexMin) * rightKnee;

            if (leftLeg2) leftLeg2.rotation.x = rest.lL2.x - leftKneeFlex;
            if (rightLeg2) rightLeg2.rotation.x = rest.rL2.x - rightKneeFlex;

            // --- FEET (ankle articulation) ---
            // Plantarflex (point toes) when leg pushes back, dorsiflex when swinging forward
            if (leftFoot) leftFoot.rotation.x = rest.lF.x - sinL * footRock;
            if (rightFoot) rightFoot.rotation.x = rest.rF.x - sinR * footRock;

            // --- TOES (flick at push-off) ---
            // Smoothly engage toes only during the push-off phase (sin < -0.3)
            const leftToeBend = Math.max(0, (-sinL - 0.3) / 0.7) * toeFlick;
            const rightToeBend = Math.max(0, (-sinR - 0.3) / 0.7) * toeFlick;
            if (leftToe) leftToe.rotation.x = rest.lT.x + leftToeBend;
            if (rightToe) rightToe.rotation.x = rest.rT.x + rightToeBend;

            // --- BODY BOUNCE (double-frequency — bounces twice per stride) ---
            // Use sin² for a smooth, natural bounce curve
            const bounce = Math.sin(p) * Math.sin(p) * bodyBounce;
            if (body) {
                body.position.y = rest.bodyPosY + bounce;
            }
        })
        .repeat(Infinity)
        .start();

    // =========================================================================
    //  TWEEN 2 — UPPER BODY (Arms)
    // =========================================================================
    const armCycle = { phase: 0 };

    const armTween = new TWEEN.Tween(armCycle)
        .to({ phase: Math.PI * 2 }, cycleTime)
        .easing(TWEEN.Easing.Linear.None)
        .onUpdate(function () {
            const p = armCycle.phase;

            // Opposite-arm-to-leg coordination:
            //   Left arm opposes left leg  (offset by π)
            //   Right arm opposes right leg (in phase with left leg)
            const sinLA = Math.sin(p + Math.PI);
            const sinRA = Math.sin(p);

            // --- UPPER ARMS (shoulder drive on Y-axis per model rigging) ---
            if (leftArm1) leftArm1.rotation.y = rest.lA1.y + sinLA * shoulderSwing;
            if (rightArm1) rightArm1.rotation.y = rest.rA1.y + sinRA * shoulderSwing;

            // --- FOREARMS (elbow flex) ---
            // Smooth blend: flex acutely when arm swings forward, extend when trailing
            const leftElbow = Math.max(0, sinLA);   // 0→1 on forward swing
            const rightElbow = Math.max(0, sinRA);
            const leftElbowFlex = elbowFlexMin + (elbowFlexMax - elbowFlexMin) * leftElbow;
            const rightElbowFlex = elbowFlexMin + (elbowFlexMax - elbowFlexMin) * rightElbow;

            if (leftArm2) leftArm2.rotation.y = rest.lA2.y - leftElbowFlex;
            if (rightArm2) rightArm2.rotation.y = rest.rA2.y + rightElbowFlex;
        })
        .repeat(Infinity)
        .start();

    // =========================================================================
    //  STORE REFERENCES (for pause / spin-attack interruption)
    // =========================================================================
    character.walkTween = legTween;
    character.armWalkTween = armTween;
    characterMovingAnimationTweens.push(legTween, armTween);
}

export function slideCharacterAnimation(character, targetZ) {
    // If the character does not have a mesh, stop the function
    if (!character.mesh) return;

    // Stop any ongoing slide tween to avoid conflicts
    if (character.slideTween) {
        character.slideTween.stop();
    }

    const slideDuration = 250; // Slide duration in milliseconds (lower = faster)

    const startZ = character.mesh.position.z;
    const diffZ = targetZ - startZ;
    if (diffZ === 0) return;

    // 1. Configure the starting point for the Z-axis
    const slidePosition = { z: startZ };

    // 2. Create the Tween for lateral movement
    const slideTween = new TWEEN.Tween(slidePosition)
        .to({ z: targetZ }, slideDuration)
        // Use Quadratic.Out for a fast start that slows down gently at the end
        .easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate(function () {

            // Move the character laterally
            character.mesh.position.z = slidePosition.z;

            // --- TRANSITION EFFECT (LEAN) ---
            // Calculate the slide progress from 0.0 to 1.0
            const progress = (slidePosition.z - startZ) / diffZ;

            // Use sine to reach maximum lean at the midpoint (0.5) and return to 0 at the end (0.2 radians is about 11 degrees)
            const leanAngle = Math.sin(progress * Math.PI) * 0.2;

            // Apply lean (Roll). Note: if the character leans forward/backward instead of sideways, change .z to .x or .y depending on orientation
            character.mesh.rotation.z = Math.sign(diffZ) * leanAngle;

        })
        .onComplete(function () {
            // Ensure the character returns perfectly upright at the end of the animation
            character.mesh.rotation.z = 0;
            character.slideTween = null;
        })
        .start();

    // 3. Save the tween to the character and the global array
    character.slideTween = slideTween;
    characterMovingAnimationTweens.push(slideTween);
}

export function jumpCharacterAnimation(character) {
    if (!character.mesh) return;

    // --- Configuration ---
    const jumpHeight = 4;     // How high the character goes on the Y axis
    const jumpDuration = 400; // Time in milliseconds to reach the apex

    // 1. JUMP UP TWEEN
    // Quadratic.Out simulates gravity slowing the momentum as they reach the top
    const jumpUpTween = new TWEEN.Tween(character.mesh.position)
        .to({ y: jumpHeight }, jumpDuration)
        .easing(TWEEN.Easing.Quadratic.Out);

    // 2. FALL DOWN TWEEN
    // Quadratic.In simulates gravity accelerating the character towards the ground
    const fallDownTween = new TWEEN.Tween(character.mesh.position)
        .to({ y: 0 }, jumpDuration)
        .easing(TWEEN.Easing.Quadratic.In)
        .onComplete(() => {
            character.isJumping = false;
        });

    // 3. CHAIN THE TWEENS
    // Tell Tween.js to automatically start falling down the moment the jump up finishes
    jumpUpTween.chain(fallDownTween);

    // 4. START THE ANIMATION
    jumpUpTween.start();
}


export function characterJumpHandler(character) {
    // 1. Prevent double jumping
    if (character.isJumping) {
        return;
    }

    // 2. Lock the jump state and trigger the animation
    character.isJumping = true;
    jumpCharacterAnimation(character);
}

export function crashHit() {
    if (character.isRotating) {
        return;
    }

    character.isRotating = true;
    spinSound.start();

    rotateCharacterAnimation(character);

}

function rotateCharacterAnimation(character) {
    if (!character.mesh) return;

    // --- Bone references ---
    const rootJoint = character.mesh.getObjectByName("GLTF_created_0_rootJoint");
    const leftLeg = character.mesh.getObjectByName("leg1_45");
    const rightLeg = character.mesh.getObjectByName("leg1001_49");
    const leftLeg2 = character.mesh.getObjectByName("leg2_44");
    const rightLeg2 = character.mesh.getObjectByName("leg2001_48");
    const leftFoot = character.mesh.getObjectByName("foot_43");
    const rightFoot = character.mesh.getObjectByName("foot001_47");
    const leftToe = character.mesh.getObjectByName("toe_42");
    const rightToe = character.mesh.getObjectByName("toe001_46");
    const leftArm = character.mesh.getObjectByName("arm1_27");
    const rightArm = character.mesh.getObjectByName("arm1001_40");
    const leftArm2 = character.mesh.getObjectByName("arm2_26");
    const rightArm2 = character.mesh.getObjectByName("arm2001_39");
    const body = character.mesh.getObjectByName("body_41");

    // --- Save the current running pose so we can restore it afterwards ---
    const savedPose = {
        rootY: rootJoint ? rootJoint.rotation.y : 0,
        leftLegX: leftLeg ? leftLeg.rotation.x : 0,
        rightLegX: rightLeg ? rightLeg.rotation.x : 0,
        leftLeg2X: leftLeg2 ? leftLeg2.rotation.x : 0,
        rightLeg2X: rightLeg2 ? rightLeg2.rotation.x : 0,
        leftFootX: leftFoot ? leftFoot.rotation.x : 0,
        rightFootX: rightFoot ? rightFoot.rotation.x : 0,
        leftToeX: leftToe ? leftToe.rotation.x : 0,
        rightToeX: rightToe ? rightToe.rotation.x : 0,
        leftArmY: leftArm ? leftArm.rotation.y : 0,
        rightArmY: rightArm ? rightArm.rotation.y : 0,
        leftArm2Y: leftArm2 ? leftArm2.rotation.y : 0,
        rightArm2Y: rightArm2 ? rightArm2.rotation.y : 0,
        bodyPosY: body ? body.position.y : 0,
    };

    // --- Pause BOTH walk tweens (legs + arms) while spinning ---
    if (character.walkTween) character.walkTween.stop();
    if (character.armWalkTween) character.armWalkTween.stop();

    // =========================================================================
    // PHASE 1 — ANTICIPATION  (bend knees + snap arms into T-pose)
    // =========================================================================
    const anticipationDuration = 50; // ms — snappy wind-up
    const kneeBend = 0.35;      // radians — slight knee bend
    const tPoseArmAngle = 1.2;       // radians — arms straight out to sides

    const anticipation = { t: 0 };
    const anticipationTween = new TWEEN.Tween(anticipation)
        .to({ t: 1 }, anticipationDuration)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate(() => {
            const t = anticipation.t;

            // Bend knees (upper leg rotates forward, lower leg rotates back)
            if (leftLeg) leftLeg.rotation.x = savedPose.leftLegX + kneeBend * t;
            if (rightLeg) rightLeg.rotation.x = savedPose.rightLegX + kneeBend * t;
            if (leftLeg2) leftLeg2.rotation.x = savedPose.leftLeg2X - kneeBend * 0.6 * t;
            if (rightLeg2) rightLeg2.rotation.x = savedPose.rightLeg2X - kneeBend * 0.6 * t;

            // Neutralize feet/toes to rest
            if (leftFoot) leftFoot.rotation.x = savedPose.leftFootX * (1 - t);
            if (rightFoot) rightFoot.rotation.x = savedPose.rightFootX * (1 - t);
            if (leftToe) leftToe.rotation.x = savedPose.leftToeX * (1 - t);
            if (rightToe) rightToe.rotation.x = savedPose.rightToeX * (1 - t);

            // Arms spread into T-pose
            if (leftArm) leftArm.rotation.y = savedPose.leftArmY - tPoseArmAngle * t;
            if (rightArm) rightArm.rotation.y = savedPose.rightArmY + tPoseArmAngle * t;
            // Straighten the forearms
            if (leftArm2) leftArm2.rotation.y = savedPose.leftArm2Y * (1 - t);
            if (rightArm2) rightArm2.rotation.y = savedPose.rightArm2Y * (1 - t);

            // Reset body bounce
            if (body) {
                body.position.y = savedPose.bodyPosY * (1 - t);
            }
        });

    // =========================================================================
    // PHASE 2 — SPIN  (3 full rotations around Y-axis, T-pose locked in)
    // =========================================================================
    const spinCount = 3;
    const spinDuration = 400; // ms total for all 3 spins — fast & snappy
    const totalRadians = Math.PI * 2 * spinCount;

    const spinStartY = savedPose.rootY;
    const spin = { angle: 0 };
    const spinTween = new TWEEN.Tween(spin)
        .to({ angle: totalRadians }, spinDuration)
        // Custom easing: sharp explosive start, clean stop
        .easing(function (k) {
            // Quadratic ease-in-out with extra punch
            if (k < 0.1) return k * 10 * k * 10 * 0.01; // explosive start
            return k < 0.5
                ? 2 * k * k
                : 1 - Math.pow(-2 * k + 2, 2) / 2;
        })
        .onUpdate(() => {
            if (rootJoint) rootJoint.rotation.y = spinStartY + spin.angle;
        });

    // =========================================================================
    // PHASE 3 — RECOVERY  (return to neutral then restart run animation)
    // =========================================================================
    const recoveryDuration = 50; // ms
    const recovery = { t: 0 };
    const recoveryTween = new TWEEN.Tween(recovery)
        .to({ t: 1 }, recoveryDuration)
        .easing(TWEEN.Easing.Quadratic.In)
        .onUpdate(() => {
            const t = recovery.t;
            // Lerp everything back to the saved walk pose
            if (leftLeg) leftLeg.rotation.x = (savedPose.leftLegX + kneeBend) + (savedPose.leftLegX - (savedPose.leftLegX + kneeBend)) * t;
            if (rightLeg) rightLeg.rotation.x = (savedPose.rightLegX + kneeBend) + (savedPose.rightLegX - (savedPose.rightLegX + kneeBend)) * t;
            if (leftLeg2) leftLeg2.rotation.x = (savedPose.leftLeg2X - kneeBend * 0.6) + (savedPose.leftLeg2X - (savedPose.leftLeg2X - kneeBend * 0.6)) * t;
            if (rightLeg2) rightLeg2.rotation.x = (savedPose.rightLeg2X - kneeBend * 0.6) + (savedPose.rightLeg2X - (savedPose.rightLeg2X - kneeBend * 0.6)) * t;

            if (leftArm) leftArm.rotation.y = (savedPose.leftArmY - tPoseArmAngle) + (savedPose.leftArmY - (savedPose.leftArmY - tPoseArmAngle)) * t;
            if (rightArm) rightArm.rotation.y = (savedPose.rightArmY + tPoseArmAngle) + (savedPose.rightArmY - (savedPose.rightArmY + tPoseArmAngle)) * t;
            if (leftArm2) leftArm2.rotation.y = savedPose.leftArm2Y * t;
            if (rightArm2) rightArm2.rotation.y = savedPose.rightArm2Y * t;
        })
        .onComplete(() => {
            // Reset every bone to the canonical rest pose (not the mid-walk snapshot)
            resetToCanonicalPose(character);

            // Unlock spin and restart the walk animation from a clean state
            character.isRotating = false;
            characterWalkAnimation(character);
        });

    // =========================================================================
    // CHAIN:  Anticipation → Spin → Recovery
    // =========================================================================
    anticipationTween.chain(spinTween);
    spinTween.chain(recoveryTween);
    anticipationTween.start();
}