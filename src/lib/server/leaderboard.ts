import Redis from 'ioredis';
import { env } from '$env/dynamic/private';

export interface HighScore {
	username: string;
	score: number;
	timestamp: number;
	message?: string;
}

const LEADERBOARD_KEY = 'leaderboard';
const LAST_UPDATE_KEY = 'leaderboard:last_update';
const RESET_THRESHOLD_SECONDS = 60 * 60 * 24; // 24 hours

let redis: Redis | null = null;
let localLeaderboard: HighScore[] = [];

function getRedis() {
	if (redis) return redis;

	// Use SvelteKit env first, then process.env as fallback
	const url = env.KV_REDIS_URL || env.KV_URL || process.env.KV_REDIS_URL || process.env.KV_URL;
	const restUrl = env.KV_REST_API_URL || process.env.KV_REST_API_URL;
	const restToken = env.KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN;

	if (url) {
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
 * Get current leaderboard (top 10 scores) and its TTL in a single operation
 */
export async function getLeaderboardWithTTL(): Promise<{ scores: HighScore[]; resetIn: number }> {
	const client = getRedis();
	if (!client) {
		return { scores: localLeaderboard.slice(0, 10), resetIn: RESET_THRESHOLD_SECONDS };
	}

	try {
		const pipeline = client.pipeline();
		pipeline.zrevrange(LEADERBOARD_KEY, 0, 9, 'WITHSCORES');
		pipeline.ttl(LAST_UPDATE_KEY);

		const results = await pipeline.exec();
		if (!results) throw new Error('Pipeline failed');

		const [err1, data] = results[0] as [Error | null, string[]];
		const [err2, ttlRaw] = results[1] as [Error | null, number];

		if (err1) throw err1;

		const leaderboard: HighScore[] = [];
		for (let i = 0; i < data.length; i += 2) {
			const member = data[i];
			const score = parseInt(data[i + 1], 10);
			const [username, timestampStr, messageBase64] = member.split('|');
			const message = messageBase64
				? Buffer.from(messageBase64, 'base64').toString('utf-8')
				: undefined;

			leaderboard.push({
				username: username || 'Unknown',
				score,
				timestamp: parseInt(timestampStr, 10) || Date.now(),
				message
			});
		}

		const ttl = typeof ttlRaw === 'number' && ttlRaw > 0 ? ttlRaw : RESET_THRESHOLD_SECONDS;
		return { scores: leaderboard, resetIn: ttl };
	} catch (e) {
		console.error('Leaderboard fetch error:', e);
		return { scores: [], resetIn: RESET_THRESHOLD_SECONDS };
	}
}

/**
 * Add a new score to the leaderboard and return the updated top 10 in a single pipeline
 */
export async function addScore(
	username: string,
	score: number,
	message?: string
): Promise<HighScore[]> {
	const client = getRedis();
	const sanitizedUsername = username.replace(/\|/g, '');
	const sanitizedMessage = message
		? message
				.trim()
				.substring(0, 100)
				.replace(/[\r\n]/g, ' ')
		: undefined;
	const messageBase64 = sanitizedMessage ? Buffer.from(sanitizedMessage).toString('base64') : '';

	if (!client) {
		const newEntry: HighScore = {
			username: sanitizedUsername,
			score,
			timestamp: Date.now(),
			message: sanitizedMessage
		};
		localLeaderboard = [...localLeaderboard, newEntry]
			.sort((a, b) => b.score - a.score)
			.slice(0, 100);
		return localLeaderboard.slice(0, 10);
	}

	try {
		const timestamp = Date.now();
		const member = `${sanitizedUsername}|${timestamp}|${messageBase64}`;

		const pipeline = client.pipeline();
		pipeline.zadd(LEADERBOARD_KEY, score, member);
		pipeline.zremrangebyrank(LEADERBOARD_KEY, 0, -101);
		pipeline.set(LAST_UPDATE_KEY, 'active', 'EX', RESET_THRESHOLD_SECONDS);
		pipeline.zrevrange(LEADERBOARD_KEY, 0, 9, 'WITHSCORES');

		const results = await pipeline.exec();
		if (!results) throw new Error('Pipeline failed');

		const [err, data] = results[3] as [Error | null, string[]];
		if (err) throw err;

		const leaderboard: HighScore[] = [];
		for (let i = 0; i < data.length; i += 2) {
			const memberItem = data[i];
			const scoreItem = parseInt(data[i + 1], 10);
			const [u, t, m] = memberItem.split('|');
			const msg = m ? Buffer.from(m, 'base64').toString('utf-8') : undefined;
			leaderboard.push({
				username: u,
				score: scoreItem,
				timestamp: parseInt(t, 10),
				message: msg
			});
		}
		return leaderboard;
	} catch (e) {
		console.error('Leaderboard add error:', e);
		throw e;
	}
}

/**
 * Reset the entire leaderboard if it has been inactive for > 3 hours
 */
export async function resetLeaderboardIfInactive(): Promise<boolean> {
	const client = getRedis();
	if (!client) return false;

	try {
		// Check if the timer key exists
		const isActive = await client.exists(LAST_UPDATE_KEY);

		if (!isActive) {
			console.log('Inactivity threshold reached (24h). Resetting leaderboard.');
			await client.del(LEADERBOARD_KEY);
			return true;
		}

		return false;
	} catch (e) {
		console.error('Leaderboard inactivity check error:', e);
		throw e;
	}
}

/**
 * Get the current best score
 */
export async function getBestScore(): Promise<HighScore | null> {
	const { scores } = await getLeaderboardWithTTL();
	return scores.length > 0 ? scores[0] : null;
}
