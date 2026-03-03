import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as db from '$lib/server/leaderboard';
import { validateSessionToken, isScoreLegit } from '$lib/server/security';
import { isRateLimited } from '$lib/server/limiter';

/**
 * Get leaderboard
 */
export const GET: RequestHandler = async () => {
    const scores = await db.getLeaderboard();
    return json(scores);
};

/**
 * Submit new score
 */
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
    const { username, score, token } = await request.json();
    
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
    
    const updatedLeaderboard = await db.addScore(sanitizedUsername, score);
    return json({ success: true, leaderboard: updatedLeaderboard });
};
