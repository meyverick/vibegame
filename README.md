# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv create --template minimal --types ts --add prettier eslint --install npm my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Production Readiness

This project has been audited for security and performance.

### Environment Variables

Required for production:

- `SESSION_SECRET`: A long random string used for signing session tokens and anti-cheat mechanisms.
- `KV_REDIS_URL` or `KV_URL`: Redis connection URL for leaderboard and rate limiting.
- `CRON_SECRET`: Optional. Secret for the `/api/leaderboard/reset` endpoint (Vercel Cron).

### Security Optimizations

- **Strict CSP:** Implemented nonce-based Content Security Policy in `svelte.config.js`.
- **Security Headers:** Configured HSTS, X-Frame-Options, X-Content-Type-Options, etc., in `src/hooks.server.ts`.
- **Anti-Cheat:** HMAC-SHA256 signed session tokens and velocity-based score validation in `src/lib/server/security.ts`.
- **Rate Limiting:** IP-based rate limiting on sensitive API endpoints.

### Performance Optimizations

- **Redis Pipelines:** Combined multiple Redis commands into single network requests to reduce latency.
- **Throttled Checks:** Leaderboard inactivity resets are throttled to once every 5 minutes per server instance.
- **Caching:** API endpoints use `Cache-Control` headers for efficient browser and CDN caching.
- **Compression:** Build-time Brotli and Gzip compression enabled for assets.
