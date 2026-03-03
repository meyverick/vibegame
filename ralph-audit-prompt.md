/ralph:loop "Conduct a rigorous security and performance audit of the entire SvelteKit workspace. Autonomously implement required fixes to ensure the project is production-ready. Adhere strictly to the 'World-as-Memory' paradigm and the 'Zero-Pronoun Policy'.

### Core Audit Objectives

1. **Security Vulnerability Remediation:**
   - Execute an `npm audit` and autonomously apply fixes (e.g., `npm audit fix`) for any identified vulnerabilities.
   - Scan for hardcoded secrets or credentials in the `.svelte`, `.ts`, and `.js` files. Remove any exposed secrets and replace them with appropriate `$env/dynamic/private` or `$env/static/public` patterns.
   - Verify that all API endpoints (e.g., `src/routes/api/leaderboard/+server.ts`) implement adequate rate limiting and input sanitization (using regex or type checking).

2. **Performance & Optimization:**
   - Audit the Svelte components (`+page.svelte`, `+layout.svelte`) for potential memory leaks, specifically focusing on `setInterval`, `setTimeout`, and `requestAnimationFrame` cleanup within `$effect` or `onMount` returns.
   - Verify that reactivity is scoped efficiently (e.g., utilizing `$derived.by` for complex calculations instead of recalculating in the main update loop).
   - Ensure that the final production build (`npm run build`) completes without any TypeScript or Svelte compilation errors.

### Engineering Constraints
- Do not fundamentally alter the game's core logic or visual aesthetics.
- Maintain the 'Zero-Pronoun Policy' in all internal code comments.
- Treat the filesystem as the sole source of truth. Do not rely on conversational memory between iterations.

### Execution Phases
- **Phase 1 (Dependency & Build Audit):** Run `npm audit` and `npm run check`. Resolve any immediate warnings or critical vulnerabilities.
- **Phase 2 (Security Scan):** Systematically inspect `src/lib/server/` and `src/routes/api/` for injection risks or missing authorization checks. Apply defensive programming patterns.
- **Phase 3 (Performance Scan):** Analyze the `requestAnimationFrame` loops in `src/routes/+page.svelte` and `src/routes/about/+page.svelte`. Ensure all intervals are cleared and objects (like particles or meteorites) are properly garbage collected when off-screen.
- **Phase 4 (Validation):** Execute `npm run build` to confirm the integrity of the applied fixes.

### Termination Criteria
Output the completion promise `<promise>PROJECT_SECURED_AND_OPTIMIZED</promise>` only after verifying that the build is successful, no high/critical vulnerabilities remain, and all asynchronous loops are provably safe."
