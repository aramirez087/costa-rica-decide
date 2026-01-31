import { Redis } from '@upstash/redis';

// Debug: Log environment variables (remove in production)
console.log('UPSTASH_REDIS_REST_URL:', process.env.UPSTASH_REDIS_REST_URL ? 'SET' : 'NOT SET');
console.log('UPSTASH_REDIS_REST_TOKEN:', process.env.UPSTASH_REDIS_REST_TOKEN ? 'SET' : 'NOT SET');

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error('Missing Upstash environment variables!');
}

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    : null;

const VALID_CANDIDATES = ['lf', 'ar', 'cd', 'arr', 'fa', 'jch', 'jab'];

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
        const { candidateId, visitorId } = req.body;

        // Validate candidate
        if (!candidateId || !VALID_CANDIDATES.includes(candidateId)) {
            return res.status(400).json({ error: 'Invalid candidate' });
        }

        // Generate a voter ID from IP + User Agent as fingerprint
        const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';
        const finalVisitorId = visitorId || `${ip}-${userAgent}`.substring(0, 100);

        // Check if already voted
        const hasVoted = await redis.sismember('voters', finalVisitorId);
        if (hasVoted) {
            return res.status(400).json({ error: 'Already voted', alreadyVoted: true });
        }

        // Record vote atomically
        const pipeline = redis.pipeline();
        pipeline.incr(`votes:${candidateId}`);
        pipeline.sadd('voters', finalVisitorId);
        await pipeline.exec();

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error submitting vote:', error);
        return res.status(500).json({ error: 'Failed to submit vote' });
    }
}
