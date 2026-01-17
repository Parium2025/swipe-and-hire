/**
 * Utility functions for draft management
 * Used by OfflineIndicator and other components to get draft status
 */

const STORAGE_PREFIX = 'parium_draft_';

/**
 * Get the most recent draft save time from localStorage
 * Returns formatted time string (e.g., "14:32") or null if no drafts exist
 */
export function getLatestDraftTime(): string | null {
  try {
    let latestTime: number | null = null;
    
    // Scan all localStorage keys for draft entries
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(STORAGE_PREFIX)) continue;
      
      try {
        const value = localStorage.getItem(key);
        if (!value) continue;
        
        const parsed = JSON.parse(value);
        
        // Check for savedAt timestamp (used by most drafts)
        if (parsed.savedAt && typeof parsed.savedAt === 'number') {
          if (!latestTime || parsed.savedAt > latestTime) {
            latestTime = parsed.savedAt;
          }
        }
      } catch {
        // Skip invalid entries
        continue;
      }
    }
    
    if (!latestTime) return null;
    
    // Format as HH:MM
    const date = new Date(latestTime);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch (error) {
    console.warn('Failed to get latest draft time:', error);
    return null;
  }
}

/**
 * Check if any drafts exist in localStorage
 */
export function hasDrafts(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Get count of active drafts
 */
export function getDraftCount(): number {
  try {
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        count++;
      }
    }
    return count;
  } catch {
    return 0;
  }
}
