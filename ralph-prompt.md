/ralph:loop "Transform the project into a Serverless-ready architecture using Vercel KV. Adhere to the 'World-as-Memory' paradigm and 'Zero-Pronoun Policy'.

### Core Production Objectives

1. **Persistent Cloud Storage:**
   - Install `@vercel/kv` using `npm install @vercel/kv`.
   - Refactor `src/lib/server/leaderboard.ts` to replace local file storage with Vercel KV.
   - Use `kv.zadd` for score submission and `kv.zrange(..., { rev: true, withScores: true })` for fetching the leaderboard.
   - Eliminate the local task queue as Redis handles concurrency natively.

2. **Distributed Rate Limiting:**
   - Refactor `src/lib/server/limiter.ts` to use Vercel KV instead of in-memory `Map`.
   - Use `kv.set(ip_key, '1', { ex: 30, nx: true })` logic to enforce a 30-second cooldown that persists across all serverless function instances.

3. **Production Security:**
   - Ensure `src/lib/server/security.ts` uses `process.env.KV_REST_API_TOKEN` or a similar secret for signing, with a fallback only for local development.
   - Remove all `fs` and `path` dependencies from the server logic to comply with serverless read-only filesystems.

### Engineering Constraints

- Do not break the existing Svelte 5 game logic.
- Maintain the 'Zero-Pronoun Policy' in all code comments.
- Ensure the project builds successfully after the transition.

### Execution Phases

- **Phase 1 (Dependencies):** Install @vercel/kv and verify environment compatibility.
- **Phase 2 (Leaderboard Refactor):** Implement Redis-backed sorted sets for high scores.
- **Phase 3 (Limiter Refactor):** Implement distributed rate limiting via Redis TTL.
- **Phase 4 (Validation):** Build the project and verify all local file dependencies are removed from server-side logic.

### Termination Criteria

Output the completion promise `<promise>SERVERLESS_READY</promise>` only after verifying that the project no longer attempts to write to the local filesystem and that the KV-based API logic is sound."
