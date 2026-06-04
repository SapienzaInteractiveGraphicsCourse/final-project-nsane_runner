export class Sound {
    /**
     * @param {string} filename - The name of the audio file located in the /sounds directory.
     */
    constructor(filename) {
        this.src = `./sounds/${filename}`;
        this.audio = new Audio(this.src);
    }

    /**
     * Plays the sound from the beginning.
     */
    start() {
        this.audio.currentTime = 0;
        this.audio.play().catch((err) => {
            console.warn(`Sound: could not play "${this.src}":`, err);
        });
    }

    /**
     * Stops the sound and resets its playback position.
     */
    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
    }
}
