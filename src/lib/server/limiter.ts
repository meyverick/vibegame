import Redis from 'ioredis';
import { env } from '$env/dynamic/private';

const REDIS_URL = env.KV_REDIS_URL || env.KV_URL;
const isRedisConfigured = !!REDIS_URL;

let redis: Redis | null = null;
const localLimits = new Map<string, number>();

function getRedis() {
    if (!isRedisConfigured) return null;
    if (!redis && REDIS_URL) {
        redis = new Redis(REDIS_URL);
    }
    return redis;
}

/**
 * Distributed rate limiter using ioredis
 */
export async function isRateLimited(key: string, cooldownSeconds: number = 30): Promise<boolean> {
    const client = getRedis();
    
    if (!client) {
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
        // 'OK' if set, null if already exists
        const result = await client.set(limitKey, '1', 'EX', cooldownSeconds, 'NX');
        
        return result === null;
    } catch (e) {
        console.error('Rate limit error:', e);
        return false;
    }
}
