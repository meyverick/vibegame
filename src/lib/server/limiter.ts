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
 * Fixed: Failed attempts no longer reset the cooldown timer.
 */
export async function isRateLimited(key: string, cooldownSeconds: number = 30): Promise<boolean> {
    const client = getRedis();
    
    if (!client) {
        const now = Date.now();
        const lastRequest = localLimits.get(key) || 0;
        
        // If we are still in cooldown, return true without updating the timestamp
        if (now - lastRequest < cooldownSeconds * 1000) {
            return true;
        }
        
        // Cooldown passed, set new timestamp and allow
        localLimits.set(key, now);
        return false;
    }

    const limitKey = `limit:${key}`;
    
    try {
        // Check if key exists first
        const exists = await client.exists(limitKey);
        
        if (exists) {
            // Already limited, do not reset the TTL
            return true;
        }
        
        // Not limited, set the key with expiration
        await client.set(limitKey, '1', 'EX', cooldownSeconds);
        return false;
    } catch (e) {
        console.error('Rate limit error:', e);
        return false;
    }
}
