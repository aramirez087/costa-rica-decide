import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const CANDIDATES = ['lf', 'ar', 'cd', 'arr', 'fa', 'jch', 'jab'];

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

    try {
        // Get all vote counts using pipeline for efficiency
        const pipeline = redis.pipeline();
        for (const id of CANDIDATES) {
            pipeline.get(`votes:${id}`);
        }
        const voteCounts = await pipeline.exec();

        const results = CANDIDATES.map((id, index) => ({
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
