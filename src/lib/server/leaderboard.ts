import Redis from 'ioredis';
import { env } from '$env/dynamic/private';

export interface HighScore {
    username: string;
    score: number;
    timestamp: number;
    message?: string;
}

const LEADERBOARD_KEY = 'leaderboard';

let redis: Redis | null = null;
let localLeaderboard: HighScore[] = [];

function getRedis() {
    if (redis) return redis;

    // Use SvelteKit env first, then process.env as fallback
    const url = env.KV_REDIS_URL || env.KV_URL || process.env.KV_REDIS_URL || process.env.KV_URL;
    const restUrl = env.KV_REST_API_URL || process.env.KV_REST_API_URL;
    const restToken = env.KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN;

    if (url) {
        console.log('Connecting to Redis via URL...');
        redis = new Redis(url);
        return redis;
    }

    if (restUrl && restToken) {
        // Note: ioredis doesn't support Vercel KV REST directly, 
        // but this block is for future-proofing or if using a Redis Proxy.
        // For now, we prefer the redis:// protocol.
    }

    return null;
}

/**
 * Get current leaderboard (top 10 scores)
 */
export async function getLeaderboard(): Promise<HighScore[]> {
    const client = getRedis();
    if (!client) {
        console.warn('Leaderboard: Redis not configured, using local in-memory fallback.');
        return localLeaderboard.slice(0, 10);
    }

    try {
        const data = await client.zrevrange(LEADERBOARD_KEY, 0, 9, 'WITHSCORES');
        
        const leaderboard: HighScore[] = [];
        for (let i = 0; i < data.length; i += 2) {
            const member = data[i];
            const score = parseInt(data[i + 1], 10);
            
            // Format: username:timestamp:base64Message
            const [username, timestampStr, messageBase64] = member.split(':');
            const message = messageBase64 ? Buffer.from(messageBase64, 'base64').toString('utf-8') : undefined;
            
            leaderboard.push({
                username,
                score,
                timestamp: parseInt(timestampStr, 10),
                message
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
export async function addScore(username: string, score: number, message?: string): Promise<HighScore[]> {
    const client = getRedis();
    
    // Sanitize message: limit length and remove newlines
    const sanitizedMessage = message ? message.trim().substring(0, 100).replace(/[\r\n]/g, ' ') : undefined;
    const messageBase64 = sanitizedMessage ? Buffer.from(sanitizedMessage).toString('base64') : '';

    if (!client) {
        const newEntry: HighScore = {
            username,
            score,
            timestamp: Date.now(),
            message: sanitizedMessage
        };
        localLeaderboard = [...localLeaderboard, newEntry]
            .sort((a, b) => b.score - a.score)
            .slice(0, 100);
        return getLeaderboard();
    }

    try {
        const timestamp = Date.now();
        // Format: username:timestamp:base64Message
        const member = `${username}:${timestamp}:${messageBase64}`;
        
        await client.zadd(LEADERBOARD_KEY, score, member);
        await client.zremrangebyrank(LEADERBOARD_KEY, 0, -101);
        
        return getLeaderboard();
    } catch (e) {
        console.error('Leaderboard add error:', e);
        throw e;
    }
}

/**
 * Reset the entire leaderboard
 */
export async function resetLeaderboard(): Promise<void> {
    const client = getRedis();
    if (!client) {
        localLeaderboard = [];
        return;
    }

    try {
        await client.del(LEADERBOARD_KEY);
    } catch (e) {
        console.error('Leaderboard reset error:', e);
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
