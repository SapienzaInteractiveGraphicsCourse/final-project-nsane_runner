const keysPressed = {
    w: false,
    a: false,
    s: false,
    d: false
};

export default keysPressed;

export function listenForPlayerMovement() {
    // Listen for key down events
    window.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        if (key in keysPressed) {
            keysPressed[key] = true;
        }
    });

    // Listen for key up events
    window.addEventListener('keyup', (event) => {
        const key = event.key.toLowerCase();
        if (key in keysPressed) {
            keysPressed[key] = false;
        }
    });

}

