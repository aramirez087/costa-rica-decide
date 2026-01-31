import { Redis } from '@upstash/redis';

// Debug logging
console.log('UPSTASH_REDIS_REST_URL:', process.env.UPSTASH_REDIS_REST_URL ? 'SET' : 'NOT SET');
console.log('UPSTASH_REDIS_REST_TOKEN:', process.env.UPSTASH_REDIS_REST_TOKEN ? 'SET' : 'NOT SET');

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    : null;

// All valid voting options: candidates + special options
const VALID_OPTIONS = ['lf', 'ar', 'cd', 'nd', 'arr', 'fa', 'jch', 'jab', 'nulo', 'indeciso'];

// Simple hash function for server-side fingerprinting
const simpleHash = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
};

export default async function handler(req: any, res: any) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!redis) {
        console.error('Redis not initialized - missing environment variables');
        return res.status(500).json({
            error: 'Database not configured',
            debug: {
                url: process.env.UPSTASH_REDIS_REST_URL ? 'present' : 'missing',
                token: process.env.UPSTASH_REDIS_REST_TOKEN ? 'present' : 'missing'
            }
        });
    }

    try {
        const { candidateId, visitorId, fingerprint, timezone, language, screenRes } = req.body;

        // Validate candidate
        if (!candidateId || !VALID_OPTIONS.includes(candidateId)) {
            return res.status(400).json({ error: 'Invalid candidate' });
        }

        // Get IP address (handle various proxy headers)
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
            || req.headers['x-real-ip']
            || req.connection?.remoteAddress
            || 'unknown';

        // Get User-Agent
        const userAgent = req.headers['user-agent'] || 'unknown';

        // Generate multiple fingerprints for deduplication
        const identifiers = [
            // 1. Client-provided fingerprint (if available)
            fingerprint ? `fp:${fingerprint.substring(0, 32)}` : null,

            // 2. Client-provided visitor ID
            visitorId ? `vid:${visitorId.substring(0, 40)}` : null,

            // 3. IP + User-Agent hash
            `ip-ua:${simpleHash(ip + userAgent)}`,

            // 4. IP + Screen resolution + Timezone (catches same device)
            screenRes && timezone ? `device:${simpleHash(ip + screenRes + timezone)}` : null,

            // 5. IP only (last resort, catches multiple accounts same network)
            `ip:${simpleHash(ip)}`,
        ].filter(Boolean);

        console.log('Vote attempt identifiers:', identifiers);

        // Check if ANY of the identifiers has already voted
        for (const identifier of identifiers) {
            const hasVoted = await redis.sismember('voters', identifier);
            if (hasVoted) {
                console.log(`Already voted with identifier: ${identifier}`);
                return res.status(400).json({
                    error: 'Already voted',
                    alreadyVoted: true,
                    reason: 'duplicate_detected'
                });
            }
        }

        // Rate limiting: Check if this IP has voted too many times recently
        const ipVoteKey = `rate:${simpleHash(ip)}`;
        const recentVotes = await redis.get(ipVoteKey);
        if (recentVotes && Number(recentVotes) >= 3) {
            console.log(`Rate limit exceeded for IP: ${ip}`);
            return res.status(429).json({
                error: 'Too many vote attempts',
                alreadyVoted: true,
                reason: 'rate_limited'
            });
        }

        // Record vote atomically
        const pipeline = redis.pipeline();

        // Increment vote count
        pipeline.incr(`votes:${candidateId}`);

        // Add ALL identifiers to voters set (prevents any of them from voting again)
        for (const identifier of identifiers) {
            pipeline.sadd('voters', identifier!);
        }

        // Increment rate limit counter with 1-hour expiry
        pipeline.incr(ipVoteKey);
        pipeline.expire(ipVoteKey, 3600);

        await pipeline.exec();

        console.log('Vote recorded successfully for candidate:', candidateId);
        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Error submitting vote:', error);
        return res.status(500).json({ error: 'Failed to submit vote' });
    }
}
