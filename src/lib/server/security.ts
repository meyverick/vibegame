import { createHmac } from 'node:crypto';
import { env } from '$env/dynamic/private';

import { building } from '$app/environment';

// Use a stable secret for local development if not provided, 
// to prevent token invalidation on every server restart during dev.
const DEVELOPMENT_SECRET = 'dev-secret-stable-123';
const SECRET = env.SESSION_SECRET || env.KV_REST_API_TOKEN || DEVELOPMENT_SECRET;

const isProd = process.env.NODE_ENV === 'production';

if (isProd && SECRET === DEVELOPMENT_SECRET && !building) {
    throw new Error('CRITICAL SECURITY ERROR: SESSION_SECRET or KV_REST_API_TOKEN must be set in production.');
}


export interface SessionData {
	startTime: number;
	signature: string;
}

/**
 * Generate a signed session token containing the start time.
 * Uses HMAC-SHA256 for cryptographic integrity.
 */
export function generateSessionToken(): string {
	const startTime = Date.now();
	const hmac = createHmac('sha256', SECRET);
	hmac.update(startTime.toString());
	const signature = hmac.digest('hex');

	// Format: startTime.signature
	return `${startTime}.${signature}`;
}

/**
 * Validate a session token and return the startTime if valid.
 * Enforces a maximum session duration to prevent token farming/replay.
 */
const MAX_SESSION_DURATION_MS = 1000 * 60 * 30; // 30 minutes max game time

export function validateSessionToken(token: string): number | null {
	if (!token || typeof token !== 'string' || !token.includes('.')) {
		return null;
	}

	try {
		const parts = token.split('.');
		if (parts.length !== 2) return null;

		const [startTimeStr, signature] = parts;
		const startTime = parseInt(startTimeStr, 10);

		if (isNaN(startTime)) return null;

		const hmac = createHmac('sha256', SECRET);
		hmac.update(startTimeStr);
		const expectedSignature = hmac.digest('hex');

		// Use timingSafeEqual if available, but for short signatures hex compare is usually acceptable
		if (signature !== expectedSignature) return null;

		const now = Date.now();
		// Prevent tokens from the future (allow 5s clock skew)
		if (startTime > now + 5000) return null;

		// Prevent tokens from the distant past
		if (now - startTime > MAX_SESSION_DURATION_MS) return null;

		return startTime;
	} catch (e) {
		return null;
	}
}

/**
 * Validate if a score is physically possible
 * Max points per second threshold (e.g., 50 points/sec based on current game tuning)
 */
const MAX_POINTS_PER_SECOND = 50;
const HARD_SCORE_CAP = 50000; // Impossible to reach this normally

export function isScoreLegit(score: number, startTime: number): boolean {
	if (score > HARD_SCORE_CAP) return false;

	const elapsedSeconds = (Date.now() - startTime) / 1000;

	// Add a small buffer (e.g. 2 seconds) for network latency
	const maxPossibleScore = (elapsedSeconds + 2) * MAX_POINTS_PER_SECOND;

	return score <= maxPossibleScore;
}
