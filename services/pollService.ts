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

export interface VoteResult {
  success: boolean;
  error?: string;
}

export const submitVote = async (candidateId: string): Promise<VoteResult> => {
  // Check for test mode in URL
  const urlParams = new URLSearchParams(window.location.search);
  const testMode = urlParams.get('testMode');
  const isTestMode = !!testMode;

  // Check locally first (fast check) - skip in test mode
  if (!isTestMode && hasVotedLocally()) {
    console.warn('Already voted (local check)');
    return { success: false, error: 'Ya has votado anteriormente.' };
  }

  try {
    // Generate voter identifier with fingerprint
    const visitorId = await getVoterIdentifier();
    const fingerprint = await generateFingerprint();

    const payload = {
      candidateId,
      visitorId,
      fingerprint,
      // Send additional verification data
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      screenRes: `${screen.width}x${screen.height}`,
    };

    console.log('Sending vote payload:', payload);
    if (isTestMode) {
      console.log('⚠️ TEST MODE - Sending with testMode param');
    }

    // Build URL with testMode if present
    const apiUrl = testMode ? `/api/vote?testMode=${testMode}` : '/api/vote';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.alreadyVoted) {
      // Server says already voted, mark locally too (unless in test mode)
      if (!isTestMode) {
        localStorage.setItem(STORAGE_KEY_VOTED, 'true');
        markAsVoted(candidateId);
      }
      return { success: false, error: data.error || 'Ya has votado anteriormente.' };
    }

    if (data.success) {
      // Mark as voted in all storage mechanisms (unless in test mode)
      if (!isTestMode) {
        localStorage.setItem(STORAGE_KEY_VOTED, 'true');
        markAsVoted(candidateId);
      }
      return { success: true };
    }

    // Handle other errors (e.g., invalid candidate)
    return { success: false, error: data.error || 'Error al enviar el voto.' };
  } catch (error) {
    console.error('Error submitting vote:', error);
    return { success: false, error: 'Error de conexión. Intenta de nuevo.' };
  }
};

