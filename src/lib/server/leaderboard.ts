import Redis from 'ioredis';
import { env } from '$env/dynamic/private';

export interface HighScore {
    username: string;
    score: number;
    timestamp: number;
}

const LEADERBOARD_KEY = 'leaderboard';

// Support Vercel KV (REST) or RedisLabs (Redis Protocol)
const REDIS_URL = env.KV_REDIS_URL || env.KV_URL;
const isRedisConfigured = !!REDIS_URL || (env.KV_REST_API_URL && env.KV_REST_API_TOKEN);

let redis: Redis | null = null;
let localLeaderboard: HighScore[] = [];

function getRedis() {
    if (!isRedisConfigured) return null;
    if (!redis) {
        // Use Redis URL if available (RedisLabs), otherwise we'd need @vercel/kv for REST.
        // Since we are moving to ioredis, we assume a redis:// protocol URL.
        if (REDIS_URL) {
            redis = new Redis(REDIS_URL);
        }
    }
    return redis;
}

/**
 * Get current leaderboard (top 10 scores)
 */
export async function getLeaderboard(): Promise<HighScore[]> {
    const client = getRedis();
    if (!client) {
        return localLeaderboard.slice(0, 10);
    }

    try {
        // Get top 10 members with their scores
        // ZREVRANGE returns members from highest to lowest score
        const data = await client.zrevrange(LEADERBOARD_KEY, 0, 9, 'WITHSCORES');
        
        const leaderboard: HighScore[] = [];
        for (let i = 0; i < data.length; i += 2) {
            const member = data[i];
            const score = parseInt(data[i + 1], 10);
            
            const [username, timestampStr] = member.split(':');
            leaderboard.push({
                username,
                score,
                timestamp: parseInt(timestampStr, 10)
            });
        }
        
        return leaderboard;
    } catch (e) {
        console.error('Leaderboard fetch error:', e);
        return [];
    }
}

/**
 * Add a new score to the leaderboard
 */
export async function addScore(username: string, score: number): Promise<HighScore[]> {
    const client = getRedis();
    if (!client) {
        const newEntry: HighScore = {
            username,
            score,
            timestamp: Date.now()
        };
        localLeaderboard = [...localLeaderboard, newEntry]
            .sort((a, b) => b.score - a.score)
            .slice(0, 100);
        return getLeaderboard();
    }

    try {
        const timestamp = Date.now();
        const member = `${username}:${timestamp}`;
        
        // Add to Sorted Set
        await client.zadd(LEADERBOARD_KEY, score, member);
        
        // Keep top 100
        await client.zremrangebyrank(LEADERBOARD_KEY, 0, -101);
        
        return getLeaderboard();
    } catch (e) {
        console.error('Leaderboard add error:', e);
        throw e;
    }
}

/**
 * Get the current best score
 */
export async function getBestScore(): Promise<HighScore | null> {
    const leaderboard = await getLeaderboard();
    return leaderboard.length > 0 ? leaderboard[0] : null;
}
