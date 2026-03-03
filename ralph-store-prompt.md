/ralph:loop "Implement a paid customization system for spaceship trailing colors and effects in `src/routes/about/+page.svelte`. Adhere to the 'World-as-Memory' paradigm and the 'Zero-Pronoun Policy'.

### Core Customization Objectives

1. **Supporter Customization State:**
   - Extend the global `settings` in `src/lib/settings.svelte.ts` to include `trailColor` (default: '#ff9d00') and `trailEffect` (default: 'classic').
   - Implement a 'Supporter Store' modal that allows users to 'Purchase' (unlock) premium trails.
   - For this prototype, 'Unlock' will be triggered by a button that sets a `isSupporter` flag in `localStorage`.

2. **Advanced Trailing Effects:**
   - Refactor the `addParticles` function to support multiple effect types:
     - **Classic (Default):** Standard orange-to-red fire particles.
     - **Plasma (Premium):** Bright cyan/magenta circles with higher glow.
     - **Ghost (Premium):** Fading trail of the player emoji itself with low opacity.
     - **Rainbow (Premium):** Particles that cycle through the CSS `hue-rotate`.
   - Update the `Particle` interface to include an `effectType` property.

3. **Customization UI:**
   - Add a 'Customize Ship' button to the Game Over and Start screens.
   - Create a polished selection panel where users can pick their unlocked color and effect.
   - Show a 'Locked' icon for premium effects if `isSupporter` is false.

### Engineering Constraints
- Use Svelte 5 runes for all reactive state.
- Ensure all new visual elements are parented inside the `shake-layer` for consistent visual feedback.
- Use the `safeTimeout` helper for any UI-related timing (e.g., purchase confirmation animations).

### Execution Phases
- **Phase 1 (Settings Expansion):** Update `settings.svelte.ts` and the `Particle` interface to support customization.
- **Phase 2 (Visual Implementation):** Implement the 'Plasma', 'Ghost', and 'Rainbow' CSS/JS logic.
- **Phase 3 (Store & UI):** Build the 'Supporter Store' and customization modal.
- **Phase 4 (Validation):** Verify that customizations persist after page refresh and build correctly.

### Termination Criteria
Output the completion promise `<promise>CUSTOMIZATION_LIVE</promise>` only after verifying that all trail effects render correctly and the 'Supporter' status is saved to `localStorage`."
