import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateSessionToken } from '$lib/server/security';

/**
 * Issue a new signed session token
 */
export const GET: RequestHandler = async () => {
    const token = generateSessionToken();
    return json({ token });
};
