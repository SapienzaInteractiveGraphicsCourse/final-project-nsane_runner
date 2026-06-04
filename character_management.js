import { slideCharacterAnimation, characterJumpHandler, crashHit } from './character_animations.js';
import { pauseGame, isPaused, isGameOver } from './game_management.js';


export function characterMovements(character) {

    document.onkeydown = function (e) {

        switch (e.key) {

            case "w":
            case "W":
            case " ":
            case "ArrowUp":
                characterJumpHandler(character);
                break;

            case "a":
            case "A":
            case "ArrowLeft":
                moveCharacter(character, 1);
                break;
            case "d":
            case "D":
            case "ArrowRight":
                moveCharacter(character, -1);
                break;

            case "Escape":
                pauseGame();
                break;

            default:
                console.log(e.key)

        }
    }

    document.onmousedown = function (e) {
        // Ignore gameplay input when paused, game over, or clicking on UI overlays
        if (isPaused || isGameOver) return;
        if (e.target.closest('#pause-overlay, #gameover-overlay, .hud')) return;

        switch (e.button) {
            case 0: // Left mouse button
                crashHit(character);
                break;
        }
    }
}

function moveCharacter(character, direction) {
    // Define the boundaries (e.g., left lane and right lane)
    var minPosition = -character.horizontalMovement;
    var maxPosition = character.horizontalMovement;

    // Normal movement based on current logical position rather than dynamic physical position
    var finalPosition = character.currentPosition - character.horizontalMovement * direction;

    // Check if the final position is within legal bounds
    if (finalPosition >= minPosition && finalPosition <= maxPosition) {
        // Update character's logical position
        character.currentPosition = finalPosition;

        // Perform the smooth slide transition instead of immediate positioning
        slideCharacterAnimation(character, finalPosition);

        console.log(character.currentPosition);
    } else {
        console.log("position out of bounds");
    }
}

const bonesNames = [
    "GLTF_created_0_rootJoint",
    "body_41",
    "head_14",
    "right_ear_0",
    "left_ear_1",
    "nose_2",
    "lip_3",
    "right_lip_4",
    "left_lip_5",
    "right_smile_6",
    "left_smile_7",
    "eyebrow1_8",
    "eyebrow2_9",
    "lower_teeth_10",
    "up_teeth_11",
    "tonque_13",
    "tonque001_12",
    "arm1_27",
    "arm2_26",
    "hand_25",
    "finger_16",
    "finger001_15",
    "finger002_18",
    "finger003_17",
    "finger004_20",
    "finger005_19",
    "finger006_22",
    "finger007_21",
    "finger008_24",
    "finger009_23",
    "arm1001_40",
    "arm2001_39",
    "hand001_38",
    "finger010_29",
    "finger011_28",
    "finger012_31",
    "finger013_30",
    "finger014_33",
    "finger015_32",
    "finger016_35",
    "finger017_34",
    "finger018_37",
    "finger019_36",
    "lower_body_51",
    "ass_50",
    "leg1_45",
    "leg2_44",
    "foot_43",
    "toe_42",
    "leg1001_49",
    "leg2001_48",
    "foot001_47",
    "toe001_46"
];

export function setCrashBones(character) {
    character.mesh.traverse(o => {
        if (o.isBone) {
            bonesNames.forEach(boneName => {
                if (o.name === boneName) {
                    console.log(o.name)
                    character.bones[boneName] = o;
                }
            })
            console.log(character.bones)
        }
    })
}