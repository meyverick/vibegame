import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as db from '$lib/server/leaderboard';
import { validateSessionToken, isScoreLegit } from '$lib/server/security';
import { isRateLimited } from '$lib/server/limiter';

let lastResetCheck = 0;
const RESET_CHECK_INTERVAL = 1000 * 60 * 5; // 5 minutes

/**
 * Get leaderboard
 */
export const GET: RequestHandler = async () => {
	const now = Date.now();
	if (now - lastResetCheck > RESET_CHECK_INTERVAL) {
		lastResetCheck = now;
		try {
			await db.resetLeaderboardIfInactive();
		} catch (e) {
			console.error('Lazy reset check failed:', e);
		}
	}

	const { scores, resetIn } = await db.getLeaderboardWithTTL();
	return json(
		{ scores, resetIn },
		{
			headers: {
				'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=30'
			}
		}
	);
};

/**
 * Submit new score
 */
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const { username, score, token, message } = await request.json();

	// 1. Basic validation
	if (!username || typeof username !== 'string' || typeof score !== 'number' || !token) {
		return json({ error: 'Invalid input' }, { status: 400 });
	}

	// 2. Rate Limiting
	const ip = getClientAddress();
	if (await isRateLimited(ip)) {
		return json({ error: 'Too many requests. Please wait 30s.' }, { status: 429 });
	}

	// 3. Session Integrity & Anti-Cheat
	const startTime = validateSessionToken(token);
	if (!startTime) {
		return json({ error: 'Invalid session token' }, { status: 403 });
	}

	if (!isScoreLegit(score, startTime)) {
		return json({ error: 'Score impossible for given time frame' }, { status: 403 });
	}

	// 4. Input Sanitization
	const sanitizedUsername = username.trim().substring(0, 20);
	const usernameRegex = /^[a-zA-Z0-9_ -]{3,20}$/;
	if (!usernameRegex.test(sanitizedUsername)) {
		return json({ error: 'Username must be 3-20 alphanumeric characters' }, { status: 400 });
	}

	// Message is optional and sanitized in db.addScore
	const updatedLeaderboard = await db.addScore(sanitizedUsername, score, message);
	return json({ success: true, leaderboard: updatedLeaderboard });
};
