import { PollData } from '../types';
import { STORAGE_KEY_VOTED } from '../constants';

// Generate a simple visitor ID for vote deduplication
const getVisitorId = (): string => {
  let visitorId = localStorage.getItem('visitor_id');
  if (!visitorId) {
    visitorId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('visitor_id', visitorId);
  }
  return visitorId;
};

export const hasUserVoted = (): boolean => {
  return !!localStorage.getItem(STORAGE_KEY_VOTED);
};

export const getPollResults = async (): Promise<PollData> => {
  try {
    const response = await fetch('/api/results');
    if (!response.ok) {
      throw new Error('Failed to fetch results');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching results:', error);
    // Return empty data on error
    return { results: [], totalVotes: 0 };
  }
};

export const submitVote = async (candidateId: string): Promise<boolean> => {
  if (hasUserVoted()) {
    return false;
  }

  try {
    const response = await fetch('/api/vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        candidateId,
        visitorId: getVisitorId(),
      }),
    });

    const data = await response.json();

    if (data.alreadyVoted) {
      // Server says already voted, mark locally too
      localStorage.setItem(STORAGE_KEY_VOTED, 'true');
      return false;
    }

    if (data.success) {
      localStorage.setItem(STORAGE_KEY_VOTED, 'true');
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error submitting vote:', error);
    return false;
  }
};
