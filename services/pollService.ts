import { PollData } from '../types';
import { STORAGE_KEY_VOTED } from '../constants';
import {
  getVoterIdentifier,
  markAsVoted,
  hasVotedLocally,
  checkIndexedDB,
  generateFingerprint
} from './voteProtection';

// Check all local storage methods for vote record
export const hasUserVoted = async (): Promise<boolean> => {
  // Check basic localStorage
  if (localStorage.getItem(STORAGE_KEY_VOTED)) return true;

  // Check our multi-storage protection
  if (hasVotedLocally()) return true;

  // Check IndexedDB (async)
  const inIndexedDB = await checkIndexedDB();
  if (inIndexedDB) return true;

  return false;
};

// Synchronous version for initial render (best effort)
export const hasUserVotedSync = (): boolean => {
  if (localStorage.getItem(STORAGE_KEY_VOTED)) return true;
  if (hasVotedLocally()) return true;
  return false;
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
  // Check locally first (fast check)
  if (hasVotedLocally()) {
    console.warn('Already voted (local check)');
    return false;
  }

  try {
    // Generate voter identifier with fingerprint
    const visitorId = await getVoterIdentifier();
    const fingerprint = await generateFingerprint();

    const response = await fetch('/api/vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        candidateId,
        visitorId,
        fingerprint,
        // Send additional verification data
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        screenRes: `${screen.width}x${screen.height}`,
      }),
    });

    const data = await response.json();

    if (data.alreadyVoted) {
      // Server says already voted, mark locally too
      localStorage.setItem(STORAGE_KEY_VOTED, 'true');
      markAsVoted(candidateId);
      return false;
    }

    if (data.success) {
      // Mark as voted in all storage mechanisms
      localStorage.setItem(STORAGE_KEY_VOTED, 'true');
      markAsVoted(candidateId);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error submitting vote:', error);
    return false;
  }
};
