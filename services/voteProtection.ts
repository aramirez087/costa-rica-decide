/**
 * Vote Fraud Prevention Utilities
 * Multiple layers of protection to prevent duplicate voting
 */

// Generate a browser fingerprint based on available characteristics
export const generateFingerprint = async (): Promise<string> => {
    const components: string[] = [];

    // Screen properties
    components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
    components.push(`${screen.availWidth}x${screen.availHeight}`);

    // Timezone
    components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
    components.push(String(new Date().getTimezoneOffset()));

    // Language
    components.push(navigator.language);
    components.push(navigator.languages?.join(',') || '');

    // Platform info
    components.push(navigator.platform);
    components.push(String(navigator.hardwareConcurrency || 0));
    components.push(String(navigator.maxTouchPoints || 0));

    // WebGL renderer (good for identifying GPU)
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl && 'getParameter' in gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '');
                components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '');
            }
        }
    } catch (e) {
        components.push('no-webgl');
    }

    // Canvas fingerprint
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillStyle = '#f60';
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = '#069';
            ctx.fillText('CR Decide 🗳️', 2, 15);
            components.push(canvas.toDataURL().slice(-50));
        }
    } catch (e) {
        components.push('no-canvas');
    }

    // Audio fingerprint (simplified)
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        components.push(String(audioContext.sampleRate));
        audioContext.close();
    } catch (e) {
        components.push('no-audio');
    }

    // Create hash from components
    const fingerprint = components.join('|');
    return await hashString(fingerprint);
};

// Hash a string using SHA-256
export const hashString = async (str: string): Promise<string> => {
    const msgBuffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Get or create a persistent voter ID stored in multiple places
export const getVoterIdentifier = async (): Promise<string> => {
    const VOTER_ID_KEY = 'cr_decide_vid';

    // Check localStorage first
    let voterId = localStorage.getItem(VOTER_ID_KEY);

    // Check sessionStorage as backup
    if (!voterId) {
        voterId = sessionStorage.getItem(VOTER_ID_KEY);
    }

    // Check cookie as another backup
    if (!voterId) {
        const cookies = document.cookie.split(';');
        const vidCookie = cookies.find(c => c.trim().startsWith(VOTER_ID_KEY + '='));
        if (vidCookie) {
            voterId = vidCookie.split('=')[1];
        }
    }

    // If no existing ID, generate new one based on fingerprint
    if (!voterId) {
        const fingerprint = await generateFingerprint();
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 10);
        voterId = `${fingerprint.substring(0, 16)}-${timestamp}-${random}`;
    }

    // Store in all locations for redundancy
    try {
        localStorage.setItem(VOTER_ID_KEY, voterId);
        sessionStorage.setItem(VOTER_ID_KEY, voterId);
        // Set cookie that expires in 1 year
        const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
        document.cookie = `${VOTER_ID_KEY}=${voterId}; expires=${expires}; path=/; SameSite=Strict`;
    } catch (e) {
        console.warn('Could not persist voter ID:', e);
    }

    return voterId;
};

// Mark locally that user has voted (multiple storage locations)
export const markAsVoted = (candidateId: string): void => {
    const VOTED_KEY = 'cr_decide_voted';
    const voteData = JSON.stringify({ voted: true, candidateId, timestamp: Date.now() });

    try {
        localStorage.setItem(VOTED_KEY, voteData);
        sessionStorage.setItem(VOTED_KEY, voteData);

        // Cookie expires in 1 year
        const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
        document.cookie = `${VOTED_KEY}=${encodeURIComponent(voteData)}; expires=${expires}; path=/; SameSite=Strict`;

        // Also store in IndexedDB for harder to clear persistence
        storeInIndexedDB(VOTED_KEY, voteData);
    } catch (e) {
        console.warn('Could not mark as voted:', e);
    }
};

// Check if user has voted locally
export const hasVotedLocally = (): boolean => {
    const VOTED_KEY = 'cr_decide_voted';

    // Check localStorage
    if (localStorage.getItem(VOTED_KEY)) return true;

    // Check sessionStorage
    if (sessionStorage.getItem(VOTED_KEY)) return true;

    // Check cookie
    if (document.cookie.includes(VOTED_KEY)) return true;

    return false;
};

// Store data in IndexedDB for persistence
const storeInIndexedDB = async (key: string, value: string): Promise<void> => {
    try {
        const request = indexedDB.open('CRDecideDB', 1);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains('votes')) {
                db.createObjectStore('votes', { keyPath: 'key' });
            }
        };

        request.onsuccess = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            const transaction = db.transaction(['votes'], 'readwrite');
            const store = transaction.objectStore('votes');
            store.put({ key, value, timestamp: Date.now() });
        };
    } catch (e) {
        console.warn('IndexedDB not available:', e);
    }
};

// Check IndexedDB for vote record
export const checkIndexedDB = (): Promise<boolean> => {
    return new Promise((resolve) => {
        try {
            const request = indexedDB.open('CRDecideDB', 1);

            request.onerror = () => resolve(false);

            request.onsuccess = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains('votes')) {
                    resolve(false);
                    return;
                }
                const transaction = db.transaction(['votes'], 'readonly');
                const store = transaction.objectStore('votes');
                const getRequest = store.get('cr_decide_voted');

                getRequest.onsuccess = () => {
                    resolve(!!getRequest.result);
                };
                getRequest.onerror = () => resolve(false);
            };
        } catch (e) {
            resolve(false);
        }
    });
};
