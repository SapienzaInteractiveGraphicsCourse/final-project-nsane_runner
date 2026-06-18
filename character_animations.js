import TWEEN from 'three/examples/jsm/libs/tween.module.js';
import { settings } from './settings.js';
import { removeTiles } from './map_generation.js';
import { Sound } from './sounds.js';
import { registerTween } from './tween_registry.js';

const spinSound = new Sound('spinSound.wav');
const punchSound = new Sound('punch.wav')


/**
 * Abstract base class that provides the locomotion methods shared by every
 * character: forward movement, jumping, lane-sliding, and speed query.
 * Subclasses must implement `characterWalkAnimation(character)`.
 */
class CharacterAnimations {

    // must be overwritten by each subclass
    /** @abstract */
    characterWalkAnimation(character) {
        throw new Error(`${this.constructor.name} must implement characterWalkAnimation()`);
    }

    // shared public API
    getCharacterSpeed() {
        return settings.currentSpeed;
    }

    moveCharacterForward(character, scene) {
        const SEGMENT_LEN = 500; // world-units per tween segment

        const scheduleSegment = () => {
            const startX = character.mesh ? character.mesh.position.x : character.position.x;
            const speed = settings.getSpeed(startX);   // dynamic!
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
                    removeTiles(scene);
                })
                .onComplete(function () {
                    scheduleSegment();
                });

            registerTween(segmentTween);
            segmentTween.start();
        };

        scheduleSegment();
        this.characterWalkAnimation(character);
    }

    /**
     * Jump arc animation (up then down).
     */
    jumpCharacterAnimation(character) {
        if (!character.mesh) return;

        const jumpHeight = 6;     // How high the character goes on the Y axis
        const jumpDuration = 550; // Time in milliseconds to reach the apex

        const jumpUpTween = new TWEEN.Tween(character.mesh.position)
            .to({ y: jumpHeight }, jumpDuration)
            .easing(TWEEN.Easing.Quadratic.Out);

        const fallDownTween = new TWEEN.Tween(character.mesh.position)
            .to({ y: 0 }, jumpDuration)
            .easing(TWEEN.Easing.Quadratic.In)
            .onComplete(() => {
                character.isJumping = false;
            });

        jumpUpTween.chain(fallDownTween);
        registerTween(jumpUpTween);
        registerTween(fallDownTween);
        jumpUpTween.start();
    }

    /**
     * Jump handler — prevents double jumping.
     */
    characterJumpHandler(character) {
        if (character.isJumping) return;
        character.isJumping = true;
        this.jumpCharacterAnimation(character);
    }

    /**
     * Smooth lateral slide animation when switching lanes.
     */
    slideCharacterAnimation(character, targetZ) {
        if (!character.mesh) return;

        if (character.slideTween) {
            character.slideTween.stop();
        }

        const slideDuration = 250;
        const startZ = character.mesh.position.z;
        const diffZ = targetZ - startZ;
        if (diffZ === 0) return;

        const slidePosition = { z: startZ };

        const slideTween = new TWEEN.Tween(slidePosition)
            .to({ z: targetZ }, slideDuration)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onUpdate(function () {
                character.mesh.position.z = slidePosition.z;

                const progress = (slidePosition.z - startZ) / diffZ;
                const leanAngle = Math.sin(progress * Math.PI) * 0.2;
                character.mesh.rotation.z = Math.sign(diffZ) * leanAngle;
            })
            .onComplete(function () {
                character.mesh.rotation.z = 0;
                character.slideTween = null;
            });

        character.slideTween = slideTween;
        registerTween(slideTween);
        slideTween.start();
    }
}



// Crash animations
export class CrashAnimations extends CharacterAnimations {


    // capture original bone rotations as rest pose
    _captureCanonicalRestPose(character) {
        if (character._canonicalRestPose) return;

        const mesh = character.mesh;
        const get = (name) => mesh.getObjectByName(name);

        const leftLeg1 = get("leg1_45");
        const leftLeg2 = get("leg2_44");
        const leftFoot = get("foot_43");
        const leftToe = get("toe_42");
        const rightLeg1 = get("leg1001_49");
        const rightLeg2 = get("leg2001_48");
        const rightFoot = get("foot001_47");
        const rightToe = get("toe001_46");
        const leftArm1 = get("arm1_27");
        const leftArm2 = get("arm2_26");
        const rightArm1 = get("arm1001_40");
        const rightArm2 = get("arm2001_39");
        const body = get("body_41");
        const rootJoint = get("GLTF_created_0_rootJoint");

        character._canonicalRestPose = {
            lL1: leftLeg1 ? leftLeg1.rotation.clone() : null,
            lL2: leftLeg2 ? leftLeg2.rotation.clone() : null,
            lF: leftFoot ? leftFoot.rotation.clone() : null,
            lT: leftToe ? leftToe.rotation.clone() : null,
            rL1: rightLeg1 ? rightLeg1.rotation.clone() : null,
            rL2: rightLeg2 ? rightLeg2.rotation.clone() : null,
            rF: rightFoot ? rightFoot.rotation.clone() : null,
            rT: rightToe ? rightToe.rotation.clone() : null,
            lA1: leftArm1 ? leftArm1.rotation.clone() : null,
            lA2: leftArm2 ? leftArm2.rotation.clone() : null,
            rA1: rightArm1 ? rightArm1.rotation.clone() : null,
            rA2: rightArm2 ? rightArm2.rotation.clone() : null,
            bodyPosY: body ? body.position.y : 0,
            rootY: rootJoint ? rootJoint.rotation.y : 0,
        };
    }

    // reset to canonical rest pose
    _resetToCanonicalPose(character) {
        const rest = character._canonicalRestPose;
        if (!rest) return;

        const mesh = character.mesh;
        const get = (name) => mesh.getObjectByName(name);

        const leftLeg1 = get("leg1_45");
        const leftLeg2 = get("leg2_44");
        const leftFoot = get("foot_43");
        const leftToe = get("toe_42");
        const rightLeg1 = get("leg1001_49");
        const rightLeg2 = get("leg2001_48");
        const rightFoot = get("foot001_47");
        const rightToe = get("toe001_46");
        const leftArm1 = get("arm1_27");
        const leftArm2 = get("arm2_26");
        const rightArm1 = get("arm1001_40");
        const rightArm2 = get("arm2001_39");
        const body = get("body_41");
        const rootJoint = get("GLTF_created_0_rootJoint");

        if (leftLeg1) leftLeg1.rotation.copy(rest.lL1);
        if (leftLeg2) leftLeg2.rotation.copy(rest.lL2);
        if (leftFoot) leftFoot.rotation.copy(rest.lF);
        if (leftToe) leftToe.rotation.copy(rest.lT);
        if (rightLeg1) rightLeg1.rotation.copy(rest.rL1);
        if (rightLeg2) rightLeg2.rotation.copy(rest.rL2);
        if (rightFoot) rightFoot.rotation.copy(rest.rF);
        if (rightToe) rightToe.rotation.copy(rest.rT);
        if (leftArm1) leftArm1.rotation.copy(rest.lA1);
        if (leftArm2) leftArm2.rotation.copy(rest.lA2);
        if (rightArm1) rightArm1.rotation.copy(rest.rA1);
        if (rightArm2) rightArm2.rotation.copy(rest.rA2);
        if (body) body.position.y = rest.bodyPosY;
        if (rootJoint) rootJoint.rotation.y = rest.rootY;
    }

    // procedural walk cycle using two tweens (legs + arms)
    characterWalkAnimation(character) {
        // Save the default starting pose on the very first run so we can always return to it
        this._captureCanonicalRestPose(character);

        // Stop and clear any walking animations that are already running
        if (character.walkTween) {
            character.walkTween.stop();
            character.walkTween = null;
        }
        if (character.armWalkTween) {
            character.armWalkTween.stop();
            character.armWalkTween = null;
        }

        // Put all the bones back to their starting positions before we begin
        this._resetToCanonicalPose(character);

        // Grab all the bone pieces for the left leg
        const leftLeg1 = character.mesh.getObjectByName("leg1_45");
        const leftLeg2 = character.mesh.getObjectByName("leg2_44");
        const leftFoot = character.mesh.getObjectByName("foot_43");
        const leftToe = character.mesh.getObjectByName("toe_42");

        // Grab all the bone pieces for the right leg
        const rightLeg1 = character.mesh.getObjectByName("leg1001_49");
        const rightLeg2 = character.mesh.getObjectByName("leg2001_48");
        const rightFoot = character.mesh.getObjectByName("foot001_47");
        const rightToe = character.mesh.getObjectByName("toe001_46");

        // Grab the arm components for both sides
        const leftArm1 = character.mesh.getObjectByName("arm1_27");
        const leftArm2 = character.mesh.getObjectByName("arm2_26");
        const rightArm1 = character.mesh.getObjectByName("arm1001_40");
        const rightArm2 = character.mesh.getObjectByName("arm2001_39");

        // Grab the main spine and the default pose reference
        const body = character.mesh.getObjectByName("body_41");
        const rest = character._canonicalRestPose;

        // Set up the timing and movement limits for a fast, snappy stride
        const cycleTime = 550;

        // Define how far the legs swing, bend, and flex
        const hipSwing = 0.7;
        const kneeFlexMax = 0.75;
        const kneeFlexMin = 0.1;
        const footRock = 0.25;
        const toeFlick = 0.2;

        // Define how much the arms swing and elbows bend
        const shoulderSwing = 0.55;
        const elbowFlexMax = 0.8;
        const elbowFlexMin = 0.1;

        // Set the amount of vertical bounce for the hips
        const bodyBounce = 0.15;

        // Set up the animation loop for the lower body and hips
        const legCycle = { phase: 0 };

        const legTween = new TWEEN.Tween(legCycle)
            .to({ phase: Math.PI * 2 }, cycleTime)
            .easing(TWEEN.Easing.Linear.None)
            .onUpdate(function () {
                const p = legCycle.phase;

                // Use sine waves to make the legs move back and forth opposite of each other
                const sinL = Math.sin(p);
                const sinR = Math.sin(p + Math.PI);

                // Swing the hips forward and backward
                if (leftLeg1) leftLeg1.rotation.x = rest.lL1.x + sinL * hipSwing;
                if (rightLeg1) rightLeg1.rotation.x = rest.rL1.x + sinR * hipSwing;

                // Figure out how much each knee should bend during its stride phase
                const leftKnee = Math.max(0, sinL);
                const rightKnee = Math.max(0, sinR);
                const leftKneeFlex = kneeFlexMin + (kneeFlexMax - kneeFlexMin) * leftKnee;
                const rightKneeFlex = kneeFlexMin + (kneeFlexMax - kneeFlexMin) * rightKnee;

                if (leftLeg2) leftLeg2.rotation.x = rest.lL2.x - leftKneeFlex;
                if (rightLeg2) rightLeg2.rotation.x = rest.rL2.x - rightKneeFlex;

                // Rock the feet at the ankles to mimic stepping and lifting
                if (leftFoot) leftFoot.rotation.x = rest.lF.x - sinL * footRock;
                if (rightFoot) rightFoot.rotation.x = rest.rF.x - sinR * footRock;

                // Make the toes bend upwards slightly right as the foot pushes off the ground
                const leftToeBend = Math.max(0, (-sinL - 0.3) / 0.7) * toeFlick;
                const rightToeBend = Math.max(0, (-sinR - 0.3) / 0.7) * toeFlick;
                if (leftToe) leftToe.rotation.x = rest.lT.x + leftToeBend;
                if (rightToe) rightToe.rotation.x = rest.rT.x + rightToeBend;

                // Make the body bounce up and down twice per full stride cycle
                const bounce = Math.sin(p) * Math.sin(p) * bodyBounce;
                if (body) {
                    body.position.y = rest.bodyPosY + bounce;
                }
            })
            .repeat(Infinity);

        registerTween(legTween);
        legTween.start();

        // Set up the animation loop for the arms
        const armCycle = { phase: 0 };

        const armTween = new TWEEN.Tween(armCycle)
            .to({ phase: Math.PI * 2 }, cycleTime)
            .easing(TWEEN.Easing.Linear.None)
            .onUpdate(function () {
                const p = armCycle.phase;

                // Sync the arms so they move opposite to the legs
                const sinLA = Math.sin(p + Math.PI);
                const sinRA = Math.sin(p);

                // Swing the shoulders along the axis required by this specific model's rig
                if (leftArm1) leftArm1.rotation.y = rest.lA1.y + sinLA * shoulderSwing;
                if (rightArm1) rightArm1.rotation.y = rest.rA1.y + sinRA * shoulderSwing;

                // Bend the elbows more when swinging forward, and straighten them going backward
                const leftElbow = Math.max(0, sinLA);
                const rightElbow = Math.max(0, sinRA);
                const leftElbowFlex = elbowFlexMin + (elbowFlexMax - elbowFlexMin) * leftElbow;
                const rightElbowFlex = elbowFlexMin + (elbowFlexMax - elbowFlexMin) * rightElbow;

                if (leftArm2) leftArm2.rotation.y = rest.lA2.y - leftElbowFlex;
                if (rightArm2) rightArm2.rotation.y = rest.rA2.y + rightElbowFlex;
            })
            .repeat(Infinity);

        registerTween(armTween);
        armTween.start();

        // Keep track of these animation loops so we can pause them or cut away to an attack animation
        character.walkTween = legTween;
        character.armWalkTween = armTween;
    }
    /**
     * Smooth lateral slide animation when switching lanes.
     */
    slideCharacterAnimation(character, targetZ) {
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
                const progress = (slidePosition.z - startZ) / diffZ;

                // Use sine to reach maximum lean at the midpoint (0.5) and return to 0 at the end
                const leanAngle = Math.sin(progress * Math.PI) * 0.2;

                // Apply lean (Roll)
                character.mesh.rotation.z = Math.sign(diffZ) * leanAngle;

            })
            .onComplete(function () {
                // Ensure the character returns perfectly upright at the end of the animation
                character.mesh.rotation.z = 0;
                character.slideTween = null;
            });

        // 3. Save the tween to the character and register it
        character.slideTween = slideTween;
        registerTween(slideTween);
        slideTween.start();
    }

    /**
     * Spin attack handler — prevents double spinning.
     */
    crashHit(character) {
        if (character.isRotating) {
            return;
        }

        character.isRotating = true;
        spinSound.start();

        this._rotateCharacterAnimation(character);
    }

    /**
     * Three-phase spin attack: anticipation → spin → recovery.
     * @private
     */
    _rotateCharacterAnimation(character) {
        if (!character.mesh) return;

        const self = this;

        // Bone references
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

        // Save the current running pose so we can restore it afterwards
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

        // Pause BOTH walk tweens (legs + arms) while spinning
        if (character.walkTween) character.walkTween.stop();
        if (character.armWalkTween) character.armWalkTween.stop();


        // PHASE 1 — ANTICIPATION  (bend knees + snap arms into T-pose)

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


        // PHASE 2 — SPIN  (3 full rotations around Y-axis, T-pose locked in)

        const spinCount = 3;
        const spinDuration = 400; // ms total for all 3 spins — fast & snappy
        const totalRadians = Math.PI * 2 * spinCount;

        const spinStartY = savedPose.rootY;
        const spin = { angle: 0 };
        const spinTween = new TWEEN.Tween(spin)
            .to({ angle: totalRadians }, spinDuration)
            // Custom easing: sharp explosive start, clean stop
            .easing(function (k) {
                if (k < 0.1) return k * 10 * k * 10 * 0.01; // explosive start
                return k < 0.5
                    ? 2 * k * k
                    : 1 - Math.pow(-2 * k + 2, 2) / 2;
            })
            .onUpdate(() => {
                if (rootJoint) rootJoint.rotation.y = spinStartY + spin.angle;
            });


        // PHASE 3 — RECOVERY  (return to neutral then restart run animation)

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
                self._resetToCanonicalPose(character);

                // Unlock spin and restart the walk animation from a clean state
                character.isRotating = false;
                self.characterWalkAnimation(character);
            });


        // CHAIN:  Anticipation → Spin → Recovery

        anticipationTween.chain(spinTween);
        spinTween.chain(recoveryTween);

        registerTween(anticipationTween);
        registerTween(spinTween);
        registerTween(recoveryTween);
        anticipationTween.start();
    }
}


// Cortex animations

/**
 * Handles all procedural bone-driven animations for the Cortex character.
 * Currently empty — will be populated once the Cortex model's bone names
 * and animation parameters are defined.
 */
export class CortexAnimations extends CharacterAnimations {


    //  CANONICAL REST POSE — captured once from the Cortex model's T-pose


    /**
     * Captures the model's original bone rotations/positions as the canonical
     * rest pose. Must be called exactly once, before any animation starts.
     * Since Cortex spawns in T-pose, these values represent the T-pose state.
     * Stores the result on `character._canonicalRestPose`.
     */
    _captureCanonicalRestPose(character) {
        if (character._canonicalRestPose) return; // already captured

        const mesh = character.mesh;
        const get = (name) => mesh.getObjectByName(name);

        const hips = get('mixamorigHips');
        const spine = get('mixamorigSpine');
        const spine1 = get('mixamorigSpine1');
        const spine2 = get('mixamorigSpine2');
        const leftUpLeg = get('mixamorigLeftUpLeg');
        const leftLeg = get('mixamorigLeftLeg');
        const leftFoot = get('mixamorigLeftFoot');
        const leftToe = get('mixamorigLeftToeBase');
        const rightUpLeg = get('mixamorigRightUpLeg');
        const rightLeg = get('mixamorigRightLeg');
        const rightFoot = get('mixamorigRightFoot');
        const rightToe = get('mixamorigRightToeBase');
        const leftArm = get('mixamorigLeftArm');
        const leftForeArm = get('mixamorigLeftForeArm');
        const rightArm = get('mixamorigRightArm');
        const rightForeArm = get('mixamorigRightForeArm');
        const leftShoulder = get('mixamorigLeftShoulder');
        const rightShoulder = get('mixamorigRightShoulder');

        character._canonicalRestPose = {
            hips: hips ? hips.rotation.clone() : null,
            hipsY: hips ? hips.position.y : 0,
            spine: spine ? spine.rotation.clone() : null,
            spine1: spine1 ? spine1.rotation.clone() : null,
            spine2: spine2 ? spine2.rotation.clone() : null,
            lUL: leftUpLeg ? leftUpLeg.rotation.clone() : null,
            lL: leftLeg ? leftLeg.rotation.clone() : null,
            lF: leftFoot ? leftFoot.rotation.clone() : null,
            lT: leftToe ? leftToe.rotation.clone() : null,
            rUL: rightUpLeg ? rightUpLeg.rotation.clone() : null,
            rL: rightLeg ? rightLeg.rotation.clone() : null,
            rF: rightFoot ? rightFoot.rotation.clone() : null,
            rT: rightToe ? rightToe.rotation.clone() : null,
            lA: leftArm ? leftArm.rotation.clone() : null,
            lFA: leftForeArm ? leftForeArm.rotation.clone() : null,
            rA: rightArm ? rightArm.rotation.clone() : null,
            rFA: rightForeArm ? rightForeArm.rotation.clone() : null,
            lS: leftShoulder ? leftShoulder.rotation.clone() : null,
            rS: rightShoulder ? rightShoulder.rotation.clone() : null,
        };
    }

    /**
     * Resets every animated bone back to the canonical rest pose.
     * Safe to call at any time — idempotent.
     */
    _resetToCanonicalPose(character) {
        const rest = character._canonicalRestPose;
        if (!rest) return;

        const mesh = character.mesh;
        const get = (name) => mesh.getObjectByName(name);

        const hips = get('mixamorigHips');
        const spine = get('mixamorigSpine');
        const spine1 = get('mixamorigSpine1');
        const spine2 = get('mixamorigSpine2');
        const leftUpLeg = get('mixamorigLeftUpLeg');
        const leftLeg = get('mixamorigLeftLeg');
        const leftFoot = get('mixamorigLeftFoot');
        const leftToe = get('mixamorigLeftToeBase');
        const rightUpLeg = get('mixamorigRightUpLeg');
        const rightLeg = get('mixamorigRightLeg');
        const rightFoot = get('mixamorigRightFoot');
        const rightToe = get('mixamorigRightToeBase');
        const leftArm = get('mixamorigLeftArm');
        const leftForeArm = get('mixamorigLeftForeArm');
        const rightArm = get('mixamorigRightArm');
        const rightForeArm = get('mixamorigRightForeArm');
        const leftShoulder = get('mixamorigLeftShoulder');
        const rightShoulder = get('mixamorigRightShoulder');

        if (hips) hips.rotation.copy(rest.hips);
        if (hips) hips.position.y = rest.hipsY;
        if (spine) spine.rotation.copy(rest.spine);
        if (spine1) spine1.rotation.copy(rest.spine1);
        if (spine2) spine2.rotation.copy(rest.spine2);
        if (leftUpLeg) leftUpLeg.rotation.copy(rest.lUL);
        if (leftLeg) leftLeg.rotation.copy(rest.lL);
        if (leftFoot) leftFoot.rotation.copy(rest.lF);
        if (leftToe) leftToe.rotation.copy(rest.lT);
        if (rightUpLeg) rightUpLeg.rotation.copy(rest.rUL);
        if (rightLeg) rightLeg.rotation.copy(rest.rL);
        if (rightFoot) rightFoot.rotation.copy(rest.rF);
        if (rightToe) rightToe.rotation.copy(rest.rT);
        if (leftArm) leftArm.rotation.copy(rest.lA);
        if (leftForeArm) leftForeArm.rotation.copy(rest.lFA);
        if (rightArm) rightArm.rotation.copy(rest.rA);
        if (rightForeArm) rightForeArm.rotation.copy(rest.rFA);
        if (leftShoulder) leftShoulder.rotation.copy(rest.lS);
        if (rightShoulder) rightShoulder.rotation.copy(rest.rS);
    }


    /**
     * Procedural walk cycle for Cortex using Mixamo bone rig.
     *
     * Since Cortex spawns in T-pose, the animation first brings the arms
     * down into a natural idle position, then applies sinusoidal walk
     * offsets for legs and contra-lateral arm swing.
     *
     * Uses two tweens (legs + arms) mirroring the Crash pattern.
     */
    characterWalkAnimation(character, skipReset = false) {
        // --- Capture the canonical rest pose exactly once (first call only) ---
        this._captureCanonicalRestPose(character);

        // --- Stop & clean up any previous walk tweens ---
        if (character.walkTween) {
            character.walkTween.stop();
            character.walkTween = null;
        }
        if (character.armWalkTween) {
            character.armWalkTween.stop();
            character.armWalkTween = null;
        }

        if (!skipReset) {
            this._resetToCanonicalPose(character);
        };

        // Bone references 
        const hips = character.mesh.getObjectByName('mixamorigHips');
        const spine = character.mesh.getObjectByName('mixamorigSpine');
        const leftUpLeg = character.mesh.getObjectByName('mixamorigLeftUpLeg');
        const leftLeg = character.mesh.getObjectByName('mixamorigLeftLeg');
        const leftFoot = character.mesh.getObjectByName('mixamorigLeftFoot');
        const leftToe = character.mesh.getObjectByName('mixamorigLeftToeBase');
        const rightUpLeg = character.mesh.getObjectByName('mixamorigRightUpLeg');
        const rightLeg = character.mesh.getObjectByName('mixamorigRightLeg');
        const rightFoot = character.mesh.getObjectByName('mixamorigRightFoot');
        const rightToe = character.mesh.getObjectByName('mixamorigRightToeBase');
        const leftArm = character.mesh.getObjectByName('mixamorigLeftArm');
        const leftForeArm = character.mesh.getObjectByName('mixamorigLeftForeArm');
        const rightArm = character.mesh.getObjectByName('mixamorigRightArm');
        const rightForeArm = character.mesh.getObjectByName('mixamorigRightForeArm');
        const leftShoulder = character.mesh.getObjectByName('mixamorigLeftShoulder');
        const rightShoulder = character.mesh.getObjectByName('mixamorigRightShoulder');

        //  USE CANONICAL REST POSE (T-pose values — the true original)
        const rest = character._canonicalRestPose;

        //  ANIMATION PARAMETERS

        const cycleTime = 550;  // ms per full stride cycle

        // --- Arm idle offset from T-pose (radians) ---
        // Brings arms down from the horizontal T-pose into a natural position.
        // For Mixamo rigs the shoulder rotates on Z to lower the arm.
        const armDownAngle = 1.2;   // ~70° down from horizontal

        // --- Leg amplitudes (radians) ---
        const hipSwing = 0.55;  // upper-leg forward/back swing
        const kneeFlexMax = 0.7;   // max calf bend when knee is lifted
        const kneeFlexMin = 0.1;   // slight residual bend on the planted leg
        const footRock = 0.2;   // ankle push-off articulation
        const toeFlick = 0.15;  // toe spring at push-off

        // --- Arm amplitudes (radians) ---
        const shoulderSwing = 0.15;  // upper-arm forward/back drive (reduced from 0.45)
        const elbowFlexMax = 0.8;   // acute elbow bend on the forward arm
        const elbowFlexMin = 0.1;   // near-straight on the trailing arm

        // --- Body dynamics ---
        const bodyBounce = 0.12;  // subtle vertical bounce amplitude (Y translation)
        const spineRock = 0.04;  // subtle spinal twist during stride


        //  TWEEN 1 — LOWER BODY (Legs + Hips Bounce)

        const legCycle = { phase: 0 };

        const legTween = new TWEEN.Tween(legCycle)
            .to({ phase: Math.PI * 2 }, cycleTime)
            .easing(TWEEN.Easing.Linear.None)
            .onUpdate(function () {
                const p = legCycle.phase;

                const sinL = Math.sin(p);
                const sinR = Math.sin(p + Math.PI);

                // UPPER LEGS

                if (leftUpLeg) leftUpLeg.rotation.x = rest.lUL.x - sinL * hipSwing;
                if (rightUpLeg) rightUpLeg.rotation.x = rest.rUL.x - sinR * hipSwing;

                // LOWER LEGS

                const leftKnee = Math.max(0, sinL);
                const rightKnee = Math.max(0, sinR);
                const leftKneeFlex = kneeFlexMin + (kneeFlexMax - kneeFlexMin) * leftKnee;
                const rightKneeFlex = kneeFlexMin + (kneeFlexMax - kneeFlexMin) * rightKnee;

                if (leftLeg) leftLeg.rotation.x = rest.lL.x + leftKneeFlex;
                if (rightLeg) rightLeg.rotation.x = rest.rL.x + rightKneeFlex;

                // FEET (ankle articulation)

                if (leftFoot) leftFoot.rotation.x = rest.lF.x + sinL * footRock;
                if (rightFoot) rightFoot.rotation.x = rest.rF.x + sinR * footRock;

                // TOES (flick at push-off)

                const leftToeBend = Math.max(0, (-sinL - 0.3) / 0.7) * toeFlick;
                const rightToeBend = Math.max(0, (-sinR - 0.3) / 0.7) * toeFlick;
                if (leftToe) leftToe.rotation.x = rest.lT.x - leftToeBend;
                if (rightToe) rightToe.rotation.x = rest.rT.x - rightToeBend;

                // HIPS BOUNCE (double-frequency — bounces twice per stride)

                if (hips) {
                    const bounce = Math.sin(p) * Math.sin(p) * bodyBounce;
                    hips.position.y = rest.hipsY + bounce;
                }

                // SPINE TWIST (subtle counter-rotation for realism)

                if (spine) {
                    spine.rotation.y = rest.spine.y + sinL * spineRock;
                }
            })
            .repeat(Infinity);

        registerTween(legTween);
        legTween.start();

        //  TWEEN 2 — UPPER BODY (Arms — brought down from T-pose + swing)

        const armCycle = { phase: 0 };
        const armCycleTime = 700;

        const armTween = new TWEEN.Tween(armCycle)
            .to({ phase: Math.PI * 2 }, armCycleTime)
            .easing(TWEEN.Easing.Linear.None)
            .onUpdate(function () {
                const p = armCycle.phase;

                // Arms swing contra-laterally to legs
                const sinLA = Math.sin(p + Math.PI); // left arm opposes left leg
                const sinRA = Math.sin(p);            // right arm opposes right leg

                // --- SHOULDERS: keep at rest pose to avoid chest collapsing ---
                if (leftShoulder) {
                    leftShoulder.rotation.copy(rest.lS);
                }
                if (rightShoulder) {
                    rightShoulder.rotation.copy(rest.rS);
                }

                // --- UPPER ARMS (position down from T-pose + forward/back swing) ---

                if (leftArm) {
                    leftArm.rotation.z = rest.lA.z - armDownAngle;
                    leftArm.rotation.y = rest.lA.y - Math.PI / 2;
                    leftArm.rotation.x = rest.lA.x + sinLA * shoulderSwing;
                }
                if (rightArm) {
                    rightArm.rotation.z = rest.rA.z + armDownAngle;
                    rightArm.rotation.y = rest.rA.y + Math.PI / 2;
                    rightArm.rotation.x = rest.rA.x + sinRA * shoulderSwing;
                }

                // --- FOREARMS (elbow flex — bends more when arm swings forward) ---
                const leftElbow = Math.max(0, sinLA);
                const rightElbow = Math.max(0, sinRA);
                const leftElbowFlex = elbowFlexMin + (elbowFlexMax - elbowFlexMin) * leftElbow;
                const rightElbowFlex = elbowFlexMin + (elbowFlexMax - elbowFlexMin) * rightElbow;

                if (leftForeArm) leftForeArm.rotation.x = rest.lFA.x + leftElbowFlex;
                if (rightForeArm) rightForeArm.rotation.x = rest.rFA.x + rightElbowFlex;
            })
            .repeat(Infinity);

        registerTween(armTween);
        armTween.start();

        character.walkTween = legTween;
        character.armWalkTween = armTween;
    }

    /**
     * Spin attack handler.
     */
    cortexHit(character) {
        if (character.isRotating) {
            return;
        }

        character.isRotating = true;
        punchSound.start();

        this._punchCharacterAnimation(character);
    }



    _punchCharacterAnimation(character) {
        if (!character.mesh) return;

        const self = this;
        const rest = character._canonicalRestPose;

        // Must mirror the matching constants in characterWalkAnimation
        const armDownAngle = 1.2;
        const elbowFlexMin = 0.1;

        // --- Bone refs ---
        const rightArm = character.mesh.getObjectByName('mixamorigRightArm');
        const rightForeArm = character.mesh.getObjectByName('mixamorigRightForeArm');
        const leftArm = character.mesh.getObjectByName('mixamorigLeftArm');
        const leftForeArm = character.mesh.getObjectByName('mixamorigLeftForeArm');
        const spine = character.mesh.getObjectByName('mixamorigSpine');

        if (character.walkTween) { character.walkTween.stop(); character.walkTween = null; }
        if (character.armWalkTween) { character.armWalkTween.stop(); character.armWalkTween = null; }

        const from = {
            rAx: rightArm ? rightArm.rotation.x : rest.rA.x,
            rAy: rightArm ? rightArm.rotation.y : rest.rA.y,
            rAz: rightArm ? rightArm.rotation.z : rest.rA.z,
            rFAx: rightForeArm ? rightForeArm.rotation.x : rest.rFA.x,
            lAx: leftArm ? leftArm.rotation.x : rest.lA.x,
            lAy: leftArm ? leftArm.rotation.y : rest.lA.y,
            lAz: leftArm ? leftArm.rotation.z : rest.lA.z,
            lFAx: leftForeArm ? leftForeArm.rotation.x : rest.lFA.x,
            spY: spine ? spine.rotation.y : rest.spine.y,
        };

        const neutral = {
            rAx: rest.rA.x,
            rAy: rest.rA.y + Math.PI / 2,
            rAz: rest.rA.z + armDownAngle,
            rFAx: rest.rFA.x + elbowFlexMin,
            lAx: rest.lA.x,
            lAy: rest.lA.y - Math.PI / 2,
            lAz: rest.lA.z - armDownAngle,
            lFAx: rest.lFA.x + elbowFlexMin,
            spY: rest.spine.y,
        };

        // PHASE 1 — WIND UP (pull arm back, flex elbow tight, twist spine right)

        const windUp = { t: 0 };
        const windUpTween = new TWEEN.Tween(windUp)
            .to({ t: 1 }, 100)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onUpdate(() => {
                const t = windUp.t;
                if (rightArm) {
                    rightArm.rotation.x = from.rAx + ((rest.rA.x - 0.8) - from.rAx) * t;
                    rightArm.rotation.y = neutral.rAy;
                    rightArm.rotation.z = from.rAz + ((rest.rA.z + 1.2) - from.rAz) * t;
                }
                if (rightForeArm) {
                    rightForeArm.rotation.x = from.rFAx + ((rest.rFA.x + 2.0) - from.rFAx) * t;
                }
                if (spine) {
                    spine.rotation.y = from.spY + ((rest.spine.y - 0.4) - from.spY) * t;
                }
            });

        // PHASE 2 — STRIKE

        const strike = { t: 0 };
        const strikeTween = new TWEEN.Tween(strike)
            .to({ t: 1 }, 100)
            .easing(TWEEN.Easing.Quadratic.In)
            .onUpdate(() => {
                const t = strike.t;
                if (rightArm) {
                    rightArm.rotation.x = (rest.rA.x - 0.8) + ((rest.rA.x + 1.5) - (rest.rA.x - 0.8)) * t;
                    rightArm.rotation.y = neutral.rAy;
                    rightArm.rotation.z = (rest.rA.z + 1.2) + ((rest.rA.z + 0.2) - (rest.rA.z + 1.2)) * t;
                }
                if (rightForeArm) {
                    rightForeArm.rotation.x = (rest.rFA.x + 2.0) + ((rest.rFA.x + 0.1) - (rest.rFA.x + 2.0)) * t;
                }
                if (spine) {
                    spine.rotation.y = (rest.spine.y - 0.4) + ((rest.spine.y + 0.5) - (rest.spine.y - 0.4)) * t;
                }
            });

        // PHASE 3 — RECOVERY (ALL animated bones → walk cycle's phase=0 neutral)
        const recovery = { t: 0 };
        const recoveryTween = new TWEEN.Tween(recovery)
            .to({ t: 1 }, 200)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onUpdate(() => {
                const t = recovery.t;

                // Right arm: strike-end pose → neutral walk pose
                if (rightArm) {
                    rightArm.rotation.x = (rest.rA.x + 1.5) + (neutral.rAx - (rest.rA.x + 1.5)) * t;
                    rightArm.rotation.y = neutral.rAy;
                    rightArm.rotation.z = (rest.rA.z + 0.2) + (neutral.rAz - (rest.rA.z + 0.2)) * t;
                }
                if (rightForeArm) {
                    rightForeArm.rotation.x = (rest.rFA.x + 0.1) + (neutral.rFAx - (rest.rFA.x + 0.1)) * t;
                }

                if (leftArm) {
                    leftArm.rotation.x = from.lAx + (neutral.lAx - from.lAx) * t;
                    leftArm.rotation.y = from.lAy + (neutral.lAy - from.lAy) * t;
                    leftArm.rotation.z = from.lAz + (neutral.lAz - from.lAz) * t;
                }
                if (leftForeArm) {
                    leftForeArm.rotation.x = from.lFAx + (neutral.lFAx - from.lFAx) * t;
                }

                if (spine) {
                    spine.rotation.y = (rest.spine.y + 0.5) + (neutral.spY - (rest.spine.y + 0.5)) * t;
                }
            })
            .onComplete(() => {
                character.isRotating = false;

                self.characterWalkAnimation(character, true);
            });

        windUpTween.chain(strikeTween);
        strikeTween.chain(recoveryTween);
        registerTween(windUpTween);
        registerTween(strikeTween);
        registerTween(recoveryTween);
        windUpTween.start();
    }


}