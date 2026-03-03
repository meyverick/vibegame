import { createHmac, randomBytes } from 'node:crypto';
import { env } from '$env/dynamic/private';

// Use a stable secret for local development if not provided, 
// to prevent token invalidation on every server restart during dev.
const DEVELOPMENT_SECRET = 'dev-secret-stable-123';
const SECRET = env.SESSION_SECRET || env.KV_REST_API_TOKEN || DEVELOPMENT_SECRET;

export interface SessionData {
    startTime: number;
    signature: string;
}

/**
 * Generate a signed session token containing the start time
 */
export function generateSessionToken(): string {
    const startTime = Date.now();
    const hmac = createHmac('sha256', SECRET);
    hmac.update(startTime.toString());
    const signature = hmac.digest('hex');
    
    // Simple token format: startTime.signature
    return `${startTime}.${signature}`;
}

/**
 * Validate a session token and return the startTime if valid
 */
const MAX_SESSION_DURATION_MS = 1000 * 60 * 30; // 30 minutes max game time

export function validateSessionToken(token: string): number | null {
    try {
        const [startTimeStr, signature] = token.split('.');
        const startTime = parseInt(startTimeStr, 10);
        
        if (isNaN(startTime)) return null;
        
        const hmac = createHmac('sha256', SECRET);
        hmac.update(startTimeStr);
        const expectedSignature = hmac.digest('hex');
        
        if (signature !== expectedSignature) return null;
        
        const now = Date.now();
        // Prevent tokens from the future
        if (startTime > now) return null;

        // Prevent tokens from the distant past (token farming/replay)
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
