import { kv } from '@vercel/kv';
import { env } from '$env/dynamic/private';

export interface HighScore {
    username: string;
    score: number;
    timestamp: number;
}

const LEADERBOARD_KEY = 'leaderboard';

// In-memory fallback for local development if KV is not configured
const getIsKvConfigured = () => env.KV_REST_API_URL && env.KV_REST_API_TOKEN;
let localLeaderboard: HighScore[] = [];

/**
 * Get current leaderboard (top 10 scores)
 * Uses Redis sorted sets (ZREVRANGE) to get high scores.
 */
export async function getLeaderboard(): Promise<HighScore[]> {
    if (!getIsKvConfigured()) {
        return localLeaderboard.slice(0, 10);
    }

    try {
        // Get top 10 members with their scores
        const data = await kv.zrange(LEADERBOARD_KEY, 0, 9, { rev: true, withScores: true });
        
        const leaderboard: HighScore[] = [];
        for (let i = 0; i < data.length; i += 2) {
            const member = data[i] as string;
            const score = data[i + 1] as number;
            
            // Member format was set as "username:timestamp" to handle multiple scores from same user
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
 * Add a new score to the leaderboard (Serverless Cloud)
 */
export async function addScore(username: string, score: number): Promise<HighScore[]> {
    if (!getIsKvConfigured()) {
        const newEntry: HighScore = {
            username,
            score,
            timestamp: Date.now()
        };
        localLeaderboard = [...localLeaderboard, newEntry]
            .sort((a, b) => b.score - a.score)
            .slice(0, 100); // Keep top 100 locally
        return getLeaderboard();
    }

    try {
        const timestamp = Date.now();
        // Use a unique member string to allow same user multiple entries
        const member = `${username}:${timestamp}`;
        
        // Atomic Add to Sorted Set
        await kv.zadd(LEADERBOARD_KEY, { score, member });
        
        // Optional: Trim the leaderboard to keep only top 100 entries to save space/cost
        // Redis handles the ranking, so we just remove everything beyond index 100
        await kv.zremrangebyrank(LEADERBOARD_KEY, 0, -101);
        
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
