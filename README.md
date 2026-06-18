# NSANE RUNNER

<br />
<p align="center">
    <img alt="NSANE RUNNER" title="NSANE RUNNER" src="./assets/images/favicon.jpg" width="300">
</p>

<p align="center">
    <em>A Crash Bandicoot–inspired endless runner</em>
</p>

---

## 🎮 About the Project

**NSANE RUNNER** is a browser-based 3D endless runner game inspired by the *Crash Bandicoot* universe. The player runs forward automatically through procedurally generated terrain, collecting Wumpa fruits, smashing crates, dodging hazards, and racking up the highest score possible before running out of lives.

The game is developed entirely in **JavaScript** using **THREE.js** for 3D rendering and **Tween.js** for smooth procedural animations.

---

## ✨ Features

- **Two Playable Characters** — Choose between **Crash Bandicoot** (GLTF model) or **Dr. Neo Cortex** (FBX model), each with their own procedural walk and attack animations.
- **Three Selectable Maps** — *Desert Canyon*, *Red Wasteland*, and *Stone Fortress*, each with unique ground textures and decorative boundary objects (totems, statues, trees, etc.).
- **Three Difficulty Levels** — *Easy*, *Medium*, and *N. Sane!*, affecting starting speed, acceleration, maximum speed, number of lives, and obstacle spawn density.
- **Dynamic Speed** — The game progressively accelerates as the player covers more distance, capped at the difficulty's max speed.
- **Procedural Map Generation** — Infinite tile-based terrain with randomised placement of collectibles, crates, and hazards.
- **Collectibles & Power-ups**:
  - **Wumpa Fruits** — Scattered across lanes; each one adds to your score.
  - **Standard Boxes** — Break them to release a Wumpa fruit.
  - **Question Boxes** — Break them for a chance to drop a coloured **Gem** (5 unique colours to collect).
  - **New Life Boxes** — Break them to earn an extra life.
  - **Aku Aku Boxes** — Break them to summon the **Aku Aku** protective mask.
  - **Nitro Boxes** — Explosive! Touching one costs a life.
  - **Gears** — Hazardous obstacles to dodge.
- **HUD** — Real-time display of Wumpa count, lives, boxes broken, score, and collected gems.
- **Pause Menu** — Pause the game with `Esc`; toggle music and SFX independently, toggle hitbox debug view, or return to the main menu.
- **Game Over Screen** — Displayed when lives reach zero, with an option to return to the main menu.
- **Sound System** — Background music (Crash Bandicoot OST) and sound effects, each independently mutable.

---

## 🕹️ Controls

| Action       | Keys                          |
|-------------|-------------------------------|
| **Jump**     | `W` / `Space` / `↑`          |
| **Move Left**| `A` / `←`                    |
| **Move Right**| `D` / `→`                   |
| **Attack**   | `Left Mouse Click`           |
| **Pause**    | `Esc`                        |

---

## 📚 Libraries Used

- **[THREE.js](https://threejs.org/)** — A lightweight, cross-browser JavaScript library used to create and display animated 3D computer graphics in a web browser using WebGL.

- **[Tween.js](https://github.com/tweenjs/tween.js)** — An open-source JavaScript tweening engine for creating simple programmatic animations (character walks, item bobbing, camera transitions, etc.).


---

## 🗂️ Project Structure

```
nsane_runner/
├── index.html                 # Main menu / splash screen
├── main.js                    # Core game loop, scene setup, asset loading
├── settings.js                # Difficulty presets, map configs, score computation
├── characters.js              # Crash, Cortex, and AkuAku class definitions
├── character_management.js    # Character controller logic and input handling
├── character_animations.js    # Procedural walk, jump, and attack animations
├── map_generation.js          # Infinite tile-based terrain generation
├── objects.js                 # Game objects: boxes, wumpa, gems, gears, etc.
├── objects_animations.js      # Item spin, bob, and drop animations
├── check_collisions.js        # Hitbox-based collision detection for all objects
├── game_management.js         # Pause, game over, and menu management
├── sounds.js                  # Audio system (music + SFX)
├── listeners.js               # Global keyboard/mouse event listeners
├── tween_registry.js          # Centralised tween lifecycle management
├── style.css                  # Main menu and splash screen styles
├── hud.html / hud.css         # In-game heads-up display
├── pause.html / pause.css     # Pause overlay UI
├── gameover.html              # Game over overlay UI
├── vite.config.js             # Vite build configuration
├── package.json               # Dependencies and scripts
└── public/                    # Static assets
    ├── crash/                 #   Crash Bandicoot 3D model (GLTF)
    ├── cortex/                #   Dr. Neo Cortex 3D model (FBX)
    ├── akuaku/                #   Aku Aku mask model (GLTF)
    ├── wumpa/                 #   Wumpa fruit model (GLTF)
    ├── gem/                   #   Gem models — 5 colours (GLB)
    ├── newlife/               #   Extra life model (GLB)
    ├── gear/                  #   Gear hazard model (GLB)
    ├── maps/                  #   Map-specific boundary decorations
    ├── textures/              #   Box textures, ground textures
    └── sounds/                #   Music and sound effects
```



## 📜 Project Documentation

- [Documentation 🔗](./documentation.pdf)

    In this file a technical presentation of the project is provided, as well as a user manual to explore every aspect of the game.

---

## 🌐 Play Online

### Play the game at the following link: [https://sapienzainteractivegraphicscourse.github.io/final-project-nsane_runner/](https://sapienzainteractivegraphicscourse.github.io/final-project-nsane_runner/)