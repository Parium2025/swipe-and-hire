/**
 * Auth Storage Manager
 * Handles storage selection (localStorage vs sessionStorage) based on "Remember Me" preference
 * and implements 24-hour inactivity timeout
 */

const REMEMBER_ME_KEY = 'parium-remember-me';
const LAST_ACTIVITY_KEY = 'parium-last-activity';
const SESSION_SENTINEL_KEY = 'parium-session-alive';
const INACTIVITY_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_SENTINEL_RECOVERY_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

const isAuthStorageKey = (key: string): boolean => {
  return (
    key.includes('supabase.auth') ||
    key.includes('supabase') ||
    key.includes('-auth-token')
  );
};

/**
 * Module-level flag shared with useInactivityTimeout.
 * Set here (in authStorage) because this is the FIRST layer that detects
 * inactivity — before useInactivityTimeout's periodic check fires.
 * This ensures onAuthStateChange in useAuth shows the correct message.
 */
let _inactivityLogoutFromStorage = false;
export const isInactivityLogoutFromStorage = () => _inactivityLogoutFromStorage;
export const clearInactivityLogoutFromStorage = () => { _inactivityLogoutFromStorage = false; };

/**
 * Session sentinel: a sessionStorage flag that indicates the browser tab is still open.
 * - Survives normal app-switching on mobile (tab stays alive in background)
 * - Disappears when the user actually closes the tab/browser/app
 * - Used to log out non-"remember me" users when they reopen a closed tab
 */
export const refreshSessionSentinel = (): void => {
  try {
    sessionStorage.setItem(SESSION_SENTINEL_KEY, '1');
  } catch {}
};

export const isSessionSentinelAlive = (): boolean => {
  try {
    return sessionStorage.getItem(SESSION_SENTINEL_KEY) === '1';
  } catch {
    return false;
  }
};

export const clearSessionSentinel = (): void => {
  try {
    sessionStorage.removeItem(SESSION_SENTINEL_KEY);
  } catch {}
};

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

const getLastActivityTimestamp = (): number => {
  try {
    const localActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    const sessionActivity = sessionStorage.getItem(LAST_ACTIVITY_KEY);

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

    return lastActivityTime;
  } catch {
    return 0;
  }
};

const hasRecentActivity = (windowMs = SESSION_SENTINEL_RECOVERY_WINDOW_MS): boolean => {
  const lastActivityTime = getLastActivityTimestamp();
  if (lastActivityTime === 0) return false;

  // On mobile, use the full inactivity timeout as the recovery window.
  // Mobile OSes routinely wipe sessionStorage when backgrounding the browser,
  // so the sentinel is unreliable — the 24h inactivity timer is the real guard.
  const effectiveWindow = isLikelyVolatileSessionStorageEnv()
    ? INACTIVITY_TIMEOUT_MS
    : windowMs;

  const diffMs = Date.now() - lastActivityTime;
  return diffMs >= 0 && diffMs <= effectiveWindow;
};

const isLikelyVolatileSessionStorageEnv = (): boolean => {
  try {
    if (typeof navigator === 'undefined') return false;
    return navigator.maxTouchPoints > 0 || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  } catch {
    return false;
  }
};

// Update last activity timestamp
export const updateLastActivity = (): void => {
  try {
    const timestamp = Date.now().toString();
    // Always update in BOTH storages to prevent mismatch issues
    localStorage.setItem(LAST_ACTIVITY_KEY, timestamp);
    sessionStorage.setItem(LAST_ACTIVITY_KEY, timestamp);
    console.log(`📝 Activity updated: ${new Date(Date.now()).toLocaleTimeString('sv-SE')}`);
  } catch (e) {
    console.warn('Failed to update last activity:', e);
  }
};

// Get formatted time since last activity (for debugging)
export const getTimeSinceLastActivity = (): string => {
  try {
    const lastActivityTime = getLastActivityTimestamp();
    
    if (lastActivityTime === 0) return 'ingen aktivitet sparad';
    
    const now = Date.now();
    const diffMs = now - lastActivityTime;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m sedan (${new Date(lastActivityTime).toLocaleTimeString('sv-SE')})`;
  } catch {
    return 'kunde inte läsa';
  }
};

// Check if session has expired due to inactivity
export const hasSessionExpiredDueToInactivity = (): boolean => {
  try {
    const lastActivityTime = getLastActivityTimestamp();
    
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
    if (isAuthStorageKey(key)) {
      // Check 24h inactivity timeout (applies to all users)
      if (hasSessionExpiredDueToInactivity()) {
        console.log('⏰ Session expired due to 24h inactivity (detected in authStorage) - logging out');
        console.log(`📊 Last activity: ${getTimeSinceLastActivity()}`);
        _inactivityLogoutFromStorage = true; // Signal to onAuthStateChange
        this.clearAuthData();
        clearActivityTracking();
        return null;
      }

      // If "remember me" is OFF, check session sentinel.
      // Missing sentinel = tab/app was closed → log out.
      // Skip this check inside iframes (Lovable preview) — the iframe reload
      // destroys sessionStorage, which would falsely trigger a logout.
      const isInsideIframe = typeof window !== 'undefined' && window.self !== window.top;
      if (!isInsideIframe && !shouldRememberUser() && !isSessionSentinelAlive()) {
        // Check if there's actually auth data stored (i.e. user was logged in before)
        const hasStoredAuth = (() => {
          try { return !!localStorage.getItem(key); } catch { return false; }
        })();
        if (hasStoredAuth) {
          if (hasRecentActivity() || isLikelyVolatileSessionStorageEnv()) {
            console.log('🔄 Session sentinel missing after recent activity — restoring tab session');
            refreshSessionSentinel();
          } else {
          console.log('🚪 Session ended: tab/app was closed without "remember me" — logging out');
          this.clearAuthData();
          clearActivityTracking();
          return null;
          }
        }
      }
    }
    
    // For auth keys: ALWAYS read from localStorage first.
    // On mobile, sessionStorage is wiped when the OS reclaims the tab/webview,
    // so relying on it causes unexpected logouts when switching apps or locking the screen.
    if (isAuthStorageKey(key)) {
      let value: string | null = null;
      try {
        value = localStorage.getItem(key);
      } catch {
        // localStorage unavailable (private browsing edge case)
      }
      // Fallback to sessionStorage if localStorage is empty
      if (!value) {
        try {
          value = sessionStorage.getItem(key);
          // Migrate to localStorage so future reads are stable
          if (value) {
            try { localStorage.setItem(key, value); } catch {}
          }
        } catch {}
      }
      return value;
    }
    
    // Non-auth keys: use preferred storage
    return this.getStorage().getItem(key);
  }

  setItem(key: string, value: string): void {
    // For supabase auth keys, always store in BOTH storages to prevent logout issues
    if (isAuthStorageKey(key)) {
      try {
        localStorage.setItem(key, value);
      } catch (lsError) {
        console.warn('Failed to write auth key to localStorage:', lsError);
      }
      try {
        sessionStorage.setItem(key, value);
      } catch (ssError) {
        console.warn('Failed to write auth key to sessionStorage:', ssError);
      }
      updateLastActivity();
      refreshSessionSentinel();
    } else {
      // For non-auth keys, use preferred storage
      this.getStorage().setItem(key, value);
    }
  }

  removeItem(key: string): void {
    // Remove from both storages to be safe
    try {
      localStorage.removeItem(key);
    } catch (lsError) {
      console.warn('Failed to remove auth key from localStorage:', lsError);
    }
    try {
      sessionStorage.removeItem(key);
    } catch (ssError) {
      console.warn('Failed to remove auth key from sessionStorage:', ssError);
    }
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
      if (key && isAuthStorageKey(key)) {
        keysToRemove.push(key);
      }
    }
    
    // Collect auth keys from sessionStorage
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && isAuthStorageKey(key) && !keysToRemove.includes(key)) {
        keysToRemove.push(key);
      }
    }
    
    // Remove all auth keys
    keysToRemove.forEach(key => {
      try { localStorage.removeItem(key); } catch (lsError) {
        console.warn(`Failed to clear auth key (${key}) from localStorage:`, lsError);
      }
      try { sessionStorage.removeItem(key); } catch (ssError) {
        console.warn(`Failed to clear auth key (${key}) from sessionStorage:`, ssError);
      }
    });
  }
}

// Singleton instance
export const authStorage = new AuthStorageAdapter();
