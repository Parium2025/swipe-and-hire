/**
 * Auth Storage Manager
 * Handles storage selection (localStorage vs sessionStorage) based on "Remember Me" preference
 * and implements 24-hour inactivity timeout
 */

const REMEMBER_ME_KEY = 'parium-remember-me';
const LAST_ACTIVITY_KEY = 'parium-last-activity';
const INACTIVITY_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

// Track if we should use persistent storage
export const shouldRememberUser = (): boolean => {
  try {
    return localStorage.getItem(REMEMBER_ME_KEY) === 'true';
  } catch {
    return false;
  }
};

// Set remember me preference
export const setRememberMe = (value: boolean): void => {
  try {
    localStorage.setItem(REMEMBER_ME_KEY, value.toString());
  } catch (e) {
    console.warn('Failed to save remember me preference:', e);
  }
};

// Update last activity timestamp
export const updateLastActivity = (): void => {
  try {
    const timestamp = Date.now().toString();
    // Always update in BOTH storages to prevent mismatch issues
    localStorage.setItem(LAST_ACTIVITY_KEY, timestamp);
    sessionStorage.setItem(LAST_ACTIVITY_KEY, timestamp);
  } catch (e) {
    console.warn('Failed to update last activity:', e);
  }
};

// Check if session has expired due to inactivity
export const hasSessionExpiredDueToInactivity = (): boolean => {
  try {
    // Check both storages for activity timestamp
    const localActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    const sessionActivity = sessionStorage.getItem(LAST_ACTIVITY_KEY);
    
    // Use the most recent activity from either storage - pick the later one
    let lastActivityTime = 0;
    
    if (localActivity) {
      const parsed = parseInt(localActivity, 10);
      if (!isNaN(parsed) && parsed > 0) {
        lastActivityTime = parsed;
      }
    }
    
    if (sessionActivity) {
      const parsed = parseInt(sessionActivity, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed > lastActivityTime) {
        lastActivityTime = parsed;
      }
    }
    
    if (lastActivityTime === 0) {
      // No valid activity recorded yet - user just logged in, don't expire
      // Instead, set the activity now to prevent future issues
      console.log('📝 No activity timestamp found, setting now');
      updateLastActivity();
      return false;
    }
    
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityTime;
    
    // Sanity check: if timestamp is in the future, it's invalid
    if (timeSinceLastActivity < 0) {
      console.warn('⚠️ Activity timestamp is in the future, resetting');
      updateLastActivity();
      return false;
    }
    
    const hoursSinceActivity = timeSinceLastActivity / (1000 * 60 * 60);
    const isExpired = timeSinceLastActivity > INACTIVITY_TIMEOUT_MS;
    
    if (isExpired) {
      console.log(`⏰ Session expired: ${hoursSinceActivity.toFixed(2)} hours since last activity (threshold: 24h)`);
    }
    
    return isExpired;
  } catch (e) {
    console.warn('⚠️ Error checking inactivity:', e);
    return false; // Never expire on error
  }
};

// Clear activity tracking
export const clearActivityTracking = (): void => {
  try {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    sessionStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch (e) {
    console.warn('Failed to clear activity tracking:', e);
  }
};

/**
 * Custom storage adapter for Supabase Auth
 * Uses localStorage when "Remember Me" is checked, sessionStorage otherwise
 * Always checks for 24-hour inactivity timeout
 */
export class AuthStorageAdapter implements Storage {
  get length(): number {
    return this.getStorage().length;
  }

  private getStorage(): Storage {
    return shouldRememberUser() ? localStorage : sessionStorage;
  }

  key(index: number): string | null {
    return this.getStorage().key(index);
  }

  getItem(key: string): string | null {
    // If session expired due to inactivity, clear auth data and return null
    if (key.includes('supabase') && hasSessionExpiredDueToInactivity()) {
      console.log('⏰ Session expired due to 24h inactivity');
      this.clearAuthData();
      clearActivityTracking();
      return null;
    }
    
    // Try the preferred storage first
    const storage = this.getStorage();
    let value = storage.getItem(key);
    
    // If not found in preferred storage, check the other one (for migration)
    if (!value && key.includes('supabase')) {
      const otherStorage = shouldRememberUser() ? sessionStorage : localStorage;
      value = otherStorage.getItem(key);
      
      // If found in other storage, migrate to preferred storage
      if (value) {
        storage.setItem(key, value);
        otherStorage.removeItem(key);
      }
    }
    
    return value;
  }

  setItem(key: string, value: string): void {
    // For supabase auth keys, always store in BOTH storages to prevent logout issues
    if (key.includes('supabase')) {
      try {
        localStorage.setItem(key, value);
      } catch {}
      try {
        sessionStorage.setItem(key, value);
      } catch {}
      updateLastActivity();
    } else {
      // For non-auth keys, use preferred storage
      this.getStorage().setItem(key, value);
    }
  }

  removeItem(key: string): void {
    // Remove from both storages to be safe
    try {
      localStorage.removeItem(key);
    } catch {}
    try {
      sessionStorage.removeItem(key);
    } catch {}
  }

  clear(): void {
    // Only clear auth-related items from both storages
    this.clearAuthData();
  }

  private clearAuthData(): void {
    const keysToRemove: string[] = [];
    
    // Collect auth keys from localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('supabase')) {
        keysToRemove.push(key);
      }
    }
    
    // Collect auth keys from sessionStorage
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.includes('supabase') && !keysToRemove.includes(key)) {
        keysToRemove.push(key);
      }
    }
    
    // Remove all auth keys
    keysToRemove.forEach(key => {
      try { localStorage.removeItem(key); } catch {}
      try { sessionStorage.removeItem(key); } catch {}
    });
  }
}

// Singleton instance
export const authStorage = new AuthStorageAdapter();
