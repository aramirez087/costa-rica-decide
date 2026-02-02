// Load environment variables for local development
import 'dotenv/config';
import { Redis } from '@upstash/redis';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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

// Helper to read body from request stream
async function readBody(req: VercelRequest): Promise<any> {
    // If body is already parsed, return it
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
        return req.body;
    }

    // Try to read from the stream
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (chunk: Buffer) => {
            data += chunk.toString();
        });
        req.on('end', () => {
            if (!data) {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(data));
            } catch (e) {
                console.error('Failed to parse body:', data);
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
        // Read body from request stream (Vercel may not auto-parse)
        const parsedBody = await readBody(req);

        // Log incoming request for debugging
        console.log('Vote request received:', {
            body: parsedBody,
            bodyType: typeof parsedBody,
            contentType: req.headers['content-type']
        });

        const { candidateId, visitorId, fingerprint, timezone, screenRes } = parsedBody || {};

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
        const forwardedFor = req.headers['x-forwarded-for'];
        const forwardedForStr = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
        const ip = forwardedForStr?.split(',')[0]?.trim()
            || req.headers['x-real-ip'] as string
            || 'unknown';

        const userAgent = req.headers['user-agent'] || 'unknown';

        // ==========================================
        // TEST MODE - Bypass duplicate checks for testing
        // ==========================================
        const testSecret = process.env.TEST_MODE_SECRET || 'cr-decide-test-2026';
        const isTestMode = req.query?.testMode === testSecret;

        if (isTestMode) {
            console.log('⚠️ TEST MODE ENABLED - Bypassing duplicate checks');
        }

        // ==========================================
        // VOTE UPDATE LOGIC
        // ==========================================
        const voterKey = visitorId ? `voter:${visitorId}` : null;
        let previousCandidateId = null;

        if (voterKey) {
            previousCandidateId = await redis.get(voterKey) as string | null;
        }

        // If trying to vote for the same candidate, just return success
        if (previousCandidateId === candidateId) {
            return res.status(200).json({ success: true, updated: false, message: 'Ya has votado por este candidato' });
        }

        // ==========================================
        // STRICT RATE LIMITING - New votes only
        // ==========================================
        const ipKey = `ip:${simpleHash(ip)}`;

        // Only check IP limit for NEW voters
        if (!previousCandidateId && !isTestMode) {
            const ipVoted = await redis.get(ipKey);
            if (ipVoted) {
                console.log(`IP already voted: ${ip}`);
                return res.status(400).json({
                    error: 'Ya has votado desde esta conexión',
                    alreadyVoted: true
                });
            }
        }

        // ==========================================
        // FINGERPRINT-BASED DEDUPLICATION - New votes only
        // ==========================================
        const identifiers = [
            fingerprint ? `fp:${fingerprint.substring(0, 32)}` : null,
            visitorId ? `vid:${visitorId.substring(0, 40)}` : null,
            `ua:${simpleHash(userAgent)}`,
            screenRes && timezone ? `dev:${simpleHash(screenRes + timezone)}` : null,
        ].filter(Boolean) as string[];

        if (!previousCandidateId && !isTestMode) {
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
        }

        // ==========================================
        // GLOBAL RATE LIMIT - Relaxed to 10,000 per minute
        // ==========================================
        const globalKey = 'global:votes:minute';
        const globalVotes = await redis.get(globalKey);

        if (globalVotes && Number(globalVotes) >= 10000) {
            console.log('Global rate limit exceeded');
            return res.status(429).json({
                error: 'Demasiado tráfico, intenta en un minuto',
                alreadyVoted: false
            });
        }

        // ==========================================
        // RECORD THE VOTE
        // ==========================================
        const pipeline = redis.pipeline();

        if (previousCandidateId) {
            // UPDATE: Decrement old, increment new
            pipeline.decr(`votes:${previousCandidateId}`);
            pipeline.incr(`votes:${candidateId}`);
            console.log(`Changing vote from ${previousCandidateId} to ${candidateId}`);
        } else {
            // NEW: Just increment new
            pipeline.incr(`votes:${candidateId}`);
        }

        // Save/Update voter record
        if (voterKey) {
            pipeline.set(voterKey, candidateId);
        }

        // Mark IP as voted (expires in 24 hours) - only for new votes
        if (!previousCandidateId) {
            pipeline.set(ipKey, '1', { ex: 86400 });
        }

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
            previousCandidateId,
            ip: simpleHash(ip),
            timestamp: Date.now(),
            isUpdate: !!previousCandidateId
        }));
        pipeline.ltrim('vote_log', 0, 999); // Keep last 1000 votes

        const results = await pipeline.exec();
        console.log('Redis pipeline results:', JSON.stringify(results));

        console.log('Vote recorded (Update:', !!previousCandidateId, ') for:', candidateId);
        return res.status(200).json({
            success: true,
            updated: !!previousCandidateId
        });

    } catch (error) {
        console.error('Error submitting vote:', error);
        return res.status(500).json({ error: 'Failed to submit vote' });
    }
}
