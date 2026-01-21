/**
 * Utility functions for draft management
 * Used by OfflineIndicator and other components to get draft status
 */

const STORAGE_PREFIX = 'parium_draft_';
const LAST_SYNC_KEY = 'parium_last_sync_time';

/**
 * Update the last sync time (call this when data is successfully fetched/saved)
 */
export function updateLastSyncTime(): void {
  try {
    localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get the most recent sync/activity time
 * Returns formatted time string (e.g., "14:32") or null if no sync recorded
 */
export function getLatestSyncTime(): string | null {
  try {
    // First check last sync time
    const syncTime = localStorage.getItem(LAST_SYNC_KEY);
    let latestTime: number | null = syncTime ? parseInt(syncTime, 10) : null;
    
    // Also check draft times and use the most recent
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
    console.warn('Failed to get latest sync time:', error);
    return null;
  }
}

/**
 * Get the most recent draft save time from localStorage
 * Returns formatted time string (e.g., "14:32") or null if no drafts exist
 * @deprecated Use getLatestSyncTime instead
 */
export function getLatestDraftTime(): string | null {
  return getLatestSyncTime();
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

/**
 * Clean up old drafts from localStorage
 * Removes drafts older than the specified max age (default: 1 day)
 * @param maxAgeMs - Maximum age in milliseconds (default: 24 hours)
 * @returns Number of drafts cleaned up
 */
export function cleanupOldDrafts(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
  try {
    const now = Date.now();
    const keysToRemove: string[] = [];
    
    // Collect keys to remove (can't modify localStorage while iterating)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(STORAGE_PREFIX)) continue;
      
      try {
        const value = localStorage.getItem(key);
        if (!value) continue;
        
        const parsed = JSON.parse(value);
        
        // Check for savedAt timestamp
        if (parsed.savedAt && typeof parsed.savedAt === 'number') {
          const age = now - parsed.savedAt;
          if (age > maxAgeMs) {
            keysToRemove.push(key);
          }
        } else {
          // No savedAt timestamp - this is an old format draft
          // Consider it stale and mark for removal
          keysToRemove.push(key);
        }
      } catch {
        // Invalid JSON - mark for removal
        keysToRemove.push(key);
      }
    }
    
    // Remove old drafts
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    if (keysToRemove.length > 0) {
      console.log(`🧹 Cleaned up ${keysToRemove.length} old draft(s)`);
    }
    
    return keysToRemove.length;
  } catch (error) {
    console.warn('Failed to cleanup old drafts:', error);
    return 0;
  }
}
