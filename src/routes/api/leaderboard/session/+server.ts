import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateSessionToken } from '$lib/server/security';
import { isRateLimited } from '$lib/server/limiter';

/**
 * Issue a new signed session token.
 * Rate limited to prevent token farming/spamming.
 */
export const GET: RequestHandler = async ({ getClientAddress }) => {
	const ip = getClientAddress();

	// Sessions are relatively cheap, but we don't want someone generating thousands per minute.
	// 5 seconds cooldown is enough to prevent spam while allowing a few retries.
	if (await isRateLimited(`session:${ip}`, 5)) {
		return json({ error: 'Too many session requests' }, { status: 429 });
	}

	const token = generateSessionToken();
	return json(
		{ token },
		{
			headers: {
				'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
				Pragma: 'no-cache',
				Expires: '0'
			}
		}
	);
};
