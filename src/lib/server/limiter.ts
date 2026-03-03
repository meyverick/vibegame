import Redis from 'ioredis';
import { env } from '$env/dynamic/private';

let redis: Redis | null = null;
const localLimits = new Map<string, number>();

function getRedis() {
	if (redis) return redis;

	const url = env.KV_REDIS_URL || env.KV_URL || process.env.KV_REDIS_URL || process.env.KV_URL;
	if (url) {
		redis = new Redis(url, {
			maxRetriesPerRequest: 1,
			retryStrategy: (times) => (times > 1 ? null : 100)
		});
		return redis;
	}
	return null;
}

/**
 * Robust rate limiter with memory fallback.
 */
export async function isRateLimited(key: string, cooldownSeconds: number = 30): Promise<boolean> {
	const client = getRedis();
	const now = Date.now();

	if (!client) {
		const lastRequest = localLimits.get(key) || 0;
		if (now - lastRequest < cooldownSeconds * 1000) {
			return true;
		}
		localLimits.set(key, now);

		// Periodic cleanup of the memory map (roughly 1 in 100 calls when size > 1000)
		if (localLimits.size > 1000 && Math.random() < 0.01) {
			const expiry = now - cooldownSeconds * 2000; // 2x cooldown to be safe
			for (const [k, v] of localLimits.entries()) {
				if (v < expiry) localLimits.delete(k);
			}
		}
		return false;
	}

	const limitKey = `limit:${key}`;
	try {
		// Use SET with EX and NX for atomic rate limiting
		const result = await client.set(limitKey, '1', 'EX', cooldownSeconds, 'NX');
		return result === null;
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Unknown error';
		console.warn('Rate limit Redis error, falling back to local memory:', message);
		const lastRequest = localLimits.get(key) || 0;
		if (now - lastRequest < cooldownSeconds * 1000) {
			return true;
		}
		localLimits.set(key, now);
		return false;
	}
}
