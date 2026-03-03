import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as db from '$lib/server/leaderboard';
import { env } from '$env/dynamic/private';

/**
 * Endpoint to reset the leaderboard
 * MUST be protected by CRON_SECRET to prevent unauthorized resets
 */
export const GET: RequestHandler = async ({ request, url }) => {
    // Check for Vercel Cron header or manual secret in URL/Headers
    const authHeader = request.headers.get('authorization');
    
    // Vercel Cron jobs send: Authorization: Bearer <CRON_SECRET>
    // Only enforce if CRON_SECRET is defined to prevent 500 errors during initial setup
    if (env.CRON_SECRET && authHeader !== `Bearer ${env.CRON_SECRET}`) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const wasReset = await db.resetLeaderboardIfInactive();
        if (wasReset) {
            return json({ success: true, message: 'Leaderboard reset due to 24h inactivity' });
        } else {
            return json({ success: true, message: 'Leaderboard remains active (top score recently updated)' });
        }
    } catch (e) {
        console.error('Leaderboard reset failed:', e);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};
