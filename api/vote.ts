// Load environment variables for local development
import 'dotenv/config';
import { Redis } from '@upstash/redis';

// Debug logging
console.log('ENV CHECK - UPSTASH_REDIS_REST_URL:', process.env.UPSTASH_REDIS_REST_URL ? 'SET' : 'NOT SET');

// Initialize Redis
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

let redis: Redis | null = null;

if (redisUrl && redisToken) {
    console.log('Initializing Redis...');
    redis = new Redis({
        url: redisUrl,
        token: redisToken,
    });
}

// All valid voting options
const VALID_OPTIONS = ['lf', 'ar', 'cd', 'nd', 'arr', 'fa', 'jch', 'jab', 'nulo', 'indeciso'];

// Simple hash function
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
        return res.status(500).json({ error: 'Database not configured' });
    }

    try {
        // Log incoming request for debugging
        console.log('Vote request received:', {
            body: req.body,
            bodyType: typeof req.body,
            contentType: req.headers['content-type']
        });

        const { candidateId, visitorId, fingerprint, timezone, screenRes } = req.body;

        // Validate candidate
        if (!candidateId || !VALID_OPTIONS.includes(candidateId)) {
            console.log('Invalid candidate:', { received: candidateId, valid: VALID_OPTIONS });
            return res.status(400).json({
                error: 'Invalid candidate',
                received: candidateId || null,
                valid: VALID_OPTIONS
            });
        }


        // Get IP address
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
            || req.headers['x-real-ip']
            || req.connection?.remoteAddress
            || 'unknown';

        const userAgent = req.headers['user-agent'] || 'unknown';

        // ==========================================
        // STRICT RATE LIMITING - 1 vote per IP per day
        // ==========================================
        const ipKey = `ip:${simpleHash(ip)}`;
        const ipVoted = await redis.get(ipKey);

        if (ipVoted) {
            console.log(`IP already voted: ${ip}`);
            return res.status(400).json({
                error: 'Ya has votado desde esta conexión',
                alreadyVoted: true
            });
        }

        // ==========================================
        // FINGERPRINT-BASED DEDUPLICATION
        // ==========================================
        const identifiers = [
            fingerprint ? `fp:${fingerprint.substring(0, 32)}` : null,
            visitorId ? `vid:${visitorId.substring(0, 40)}` : null,
            `ua:${simpleHash(userAgent)}`,
            screenRes && timezone ? `dev:${simpleHash(screenRes + timezone)}` : null,
        ].filter(Boolean) as string[];

        // Check if any identifier already voted
        for (const id of identifiers) {
            const voted = await redis.sismember('voters', id);
            if (voted) {
                console.log(`Already voted with: ${id}`);
                return res.status(400).json({
                    error: 'Ya has votado',
                    alreadyVoted: true
                });
            }
        }

        // ==========================================
        // GLOBAL RATE LIMIT - Max 10 votes per minute total
        // ==========================================
        const globalKey = 'global:votes:minute';
        const globalVotes = await redis.get(globalKey);

        if (globalVotes && Number(globalVotes) >= 10) {
            console.log('Global rate limit exceeded');
            return res.status(429).json({
                error: 'Demasiados votos, intenta en un minuto',
                alreadyVoted: false
            });
        }

        // ==========================================
        // RECORD THE VOTE
        // ==========================================
        const pipeline = redis.pipeline();

        // Increment vote count
        pipeline.incr(`votes:${candidateId}`);

        // Mark IP as voted (expires in 24 hours)
        pipeline.set(ipKey, '1', { ex: 86400 });

        // Add all identifiers to voters set
        for (const id of identifiers) {
            pipeline.sadd('voters', id);
        }

        // Increment global rate limit (expires in 60 seconds)
        pipeline.incr(globalKey);
        pipeline.expire(globalKey, 60);

        // Log vote with timestamp
        pipeline.lpush('vote_log', JSON.stringify({
            candidateId,
            ip: simpleHash(ip),
            timestamp: Date.now()
        }));
        pipeline.ltrim('vote_log', 0, 999); // Keep last 1000 votes

        await pipeline.exec();

        console.log('Vote recorded for:', candidateId);
        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Error submitting vote:', error);
        return res.status(500).json({ error: 'Failed to submit vote' });
    }
}
