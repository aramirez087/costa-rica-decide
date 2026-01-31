// Load environment variables for local development
import 'dotenv/config';
import { Redis } from '@upstash/redis';

// Debug logging
console.log('ENV CHECK - UPSTASH_REDIS_REST_URL:', process.env.UPSTASH_REDIS_REST_URL ? 'SET' : 'NOT SET');
console.log('ENV CHECK - UPSTASH_REDIS_REST_TOKEN:', process.env.UPSTASH_REDIS_REST_TOKEN ? 'SET' : 'NOT SET');

// Initialize Redis
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

let redis: Redis | null = null;

if (redisUrl && redisToken) {
    console.log('Initializing Redis with URL:', redisUrl.substring(0, 30) + '...');
    redis = new Redis({
        url: redisUrl,
        token: redisToken,
    });
} else {
    console.error('Missing Redis credentials!');
}

// All voting options: candidates + special options
const ALL_OPTIONS = ['lf', 'ar', 'cd', 'nd', 'arr', 'fa', 'jch', 'jab', 'nulo', 'indeciso'];

export default async function handler(req: any, res: any) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
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
        // Get all vote counts using pipeline for efficiency
        const pipeline = redis.pipeline();
        for (const id of ALL_OPTIONS) {
            pipeline.get(`votes:${id}`);
        }
        const voteCounts = await pipeline.exec();

        const results = ALL_OPTIONS.map((id, index) => ({
            candidateId: id,
            votes: Number(voteCounts[index]) || 0,
        }));

        // Sort by votes descending
        results.sort((a, b) => b.votes - a.votes);

        const totalVotes = results.reduce((acc, curr) => acc + curr.votes, 0);

        return res.status(200).json({ results, totalVotes });
    } catch (error) {
        console.error('Error fetching results:', error);
        return res.status(500).json({ error: 'Failed to fetch results' });
    }
}
