/ralph:loop "Implement the Time Dilation power-up and Unlockable Ship system in `src/routes/about/+page.svelte`. Adhere to the 'World-as-Memory' paradigm and 'Zero-Pronoun Policy'.

### Core Feature Objectives

1. **Time Dilation (⏳ Power-up):**
   - Implement a `timeScale` state (default 1.0).
   - Create a ⏳ bonus that spawns occasionally. Upon collection, set `timeScale` to 0.25 for 5 seconds using `safeTimeout`.
   - Multiply the velocity updates of meteorites, the Tax Collector, and the intensity of the `warp-vortex` pull by this `timeScale`.
   - Add a visual 'Time Warp' effect to the `shake-layer` (e.g., a green tint or chromatic aberration) when active.

2. **Unlockable Ship System:**
   - Define a progression system based on the user's local personal best score:
     - > 0 pts: 🚀 (Default)
     - > 250 pts: 🛸 (UFO)
     - > 750 pts: 🛰️ (Satellite)
     - > 1500 pts: 👾 (Invader)
   - Store the player's 'Best Local Score' in `localStorage` to persist unlocks across sessions.
   - Update the `playerEmoji` derived state to automatically reflect the highest unlocked ship.
   - Add an 'Unlocked Ships' preview section to the Game Over screen.

### Engineering Constraints

- Use Svelte 5 runes (`$state`, `$derived`, `$effect`) exclusively.
- Ensure all new asynchronous logic utilizes the `safeTimeout` helper to prevent memory leaks.
- Maintain the 'Zero-Pronoun Policy' in all code comments.

### Execution Phases

- **Phase 1 (Physics Refactor):** Introduce the `timeScale` variable and apply the multiplier to all movement and gravity calculations.
- **Phase 2 (Time Power-up):** Implement the ⏳ bonus spawning, collection logic, and the visual CSS filter.
- **Phase 3 (Persistence & Unlocks):** Implement `localStorage` handling for the personal best and update the player avatar logic.
- **Phase 4 (Validation):** Build the project and verify that time dilation correctly slows the world without affecting the player's own responsiveness.

### Termination Criteria

Output the completion promise `<promise>FEATURES_EXPANDED</promise>` only after verifying that the ship unlocks persist after a page refresh and the time dilation effect resets correctly after 5 seconds."
