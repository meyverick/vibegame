import { kv } from '@vercel/kv';
import { env } from '$env/dynamic/private';

const getIsKvConfigured = () => env.KV_REST_API_URL && env.KV_REST_API_TOKEN;
const localLimits = new Map<string, number>();

/**
 * Distributed rate limiter using Vercel KV
 * Uses Redis TTL to enforce a cooldown across all serverless instances.
 * Falls back to in-memory Map for local development.
 */
export async function isRateLimited(key: string, cooldownSeconds: number = 30): Promise<boolean> {
    if (!getIsKvConfigured()) {
        const now = Date.now();
        const lastRequest = localLimits.get(key) || 0;
        if (now - lastRequest < cooldownSeconds * 1000) {
            return true;
        }
        localLimits.set(key, now);
        return false;
    }

    const limitKey = `limit:${key}`;
    
    try {
        // NX: only set if it does not exist
        // EX: set expiration in seconds
        const result = await kv.set(limitKey, '1', { ex: cooldownSeconds, nx: true });
        
        // If result is null, the key already existed (user is rate limited)
        return result === null;
    } catch (e) {
        console.error('Rate limit error:', e);
        // Fallback: allow request if KV is down to not block legitimate users
        return false;
    }
}
