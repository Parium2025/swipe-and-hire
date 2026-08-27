/**
 * Auth Storage Manager
 *
 * Per-tab session isolation:
 * - Auth tokens live in `sessionStorage` (primary). Each browser tab gets its
 *   own session, so logging out in one tab does NOT log out other tabs.
 * - When "Remember Me" is enabled, we keep a SNAPSHOT under a renamed key in
 *   `localStorage` (`parium-auth-snapshot:<key>`). Supabase's GoTrueClient does
 *   NOT listen on this key, so writes do not trigger cross-tab sync.
 * - On first read of an auth key in a fresh tab, if `sessionStorage` is empty
 *   and we have a snapshot, we hydrate from it. This gives us the
 *   "open in new tab while logged in" UX without sharing live state.
 * - Inactivity timeout (24h) still applies.
 */

const REMEMBER_ME_KEY = 'parium-remember-me';
const LAST_ACTIVITY_KEY = 'parium-last-activity';
const INACTIVITY_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

const SNAPSHOT_PREFIX = 'parium-auth-snapshot:';
/**
 * Ägaren av "Håll mig inloggad"-snapshoten = user id för det konto som senast
 * loggade in explicit. Utan detta kunde en gammal flik med ETT ANNAT konto
 * skriva över snapshoten vid sin bakgrunds-tokenrefresh, så att nästa
 * webbläsarstart hydrerade fel konto (t.ex. arbetsgivare i stället för
 * jobbsökare).
 */
const SNAPSHOT_OWNER_KEY = 'parium-auth-snapshot-owner';

const SUPABASE_AUTH_KEY_PATTERN = /sb-[a-z0-9]+-auth-token/;

const isAuthStorageKey = (key: string): boolean => {
  return SUPABASE_AUTH_KEY_PATTERN.test(key) || key.includes('supabase.auth');
};

const snapshotKey = (key: string) => `${SNAPSHOT_PREFIX}${key}`;

/** Plockar ut user id ur ett serialiserat GoTrue-sessionsvärde. */
const extractUserId = (value: string): string | null => {
  try {
    const parsed = JSON.parse(value);
    return parsed?.user?.id ?? parsed?.currentSession?.user?.id ?? null;
  } catch {
    return null;
  }
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
 * In-memory mirror used when localStorage is unavailable (Lovable-preview
 * iframe with partitionerad lagring, inkognito, Safari ITP m.m.).
 * Utan detta blir "Håll mig inloggad" helt verkningslös i preview.
 */
const memoryMirror = new Map<string, string>();

const readLocal = (key: string): string | null => {
  try {
    const v = localStorage.getItem(key);
    if (v !== null) return v;
  } catch {}
  return memoryMirror.has(key) ? memoryMirror.get(key)! : null;
};

const writeLocal = (key: string, value: string): void => {
  memoryMirror.set(key, value);
  try { localStorage.setItem(key, value); } catch {}
};

const removeLocal = (key: string): void => {
  memoryMirror.delete(key);
  try { localStorage.removeItem(key); } catch {}
};

// Track if we should use persistent storage
export const shouldRememberUser = (): boolean => {
  if (readLocal(REMEMBER_ME_KEY) === 'true') return true;
  // Fallback: preferensen speglas även i sessionStorage så att den överlever
  // en blockerad localStorage inom samma flik/iframe.
  try {
    return sessionStorage.getItem(REMEMBER_ME_KEY) === 'true';
  } catch {
    return false;
  }
};


// Set remember me preference
export const setRememberMe = (value: boolean): void => {
  writeLocal(REMEMBER_ME_KEY, value.toString());
  try { sessionStorage.setItem(REMEMBER_ME_KEY, value.toString()); } catch {}

  // If user turns Remember Me OFF, wipe any existing snapshots so future
  // tabs don't auto-restore.
  if (!value) {
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(SNAPSHOT_PREFIX)) toRemove.push(k);
      }
      toRemove.forEach((k) => removeLocal(k));
    } catch {}
    Array.from(memoryMirror.keys())
      .filter((k) => k.startsWith(SNAPSHOT_PREFIX))
      .forEach((k) => memoryMirror.delete(k));
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


// Update last activity timestamp
export const updateLastActivity = (): void => {
  try {
    const timestamp = Date.now().toString();
    localStorage.setItem(LAST_ACTIVITY_KEY, timestamp);
    sessionStorage.setItem(LAST_ACTIVITY_KEY, timestamp);
  } catch {
    // Silently fail — not critical
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
      console.log('📝 No activity timestamp found, setting now');
      updateLastActivity();
      return false;
    }
    
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityTime;
    
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
 * Custom storage adapter for Supabase Auth.
 *
 * Strategy: per-tab isolation via sessionStorage + optional Remember Me snapshot
 * stored under a renamed key in localStorage (so cross-tab storage events do
 * NOT fire on the actual auth token).
 */
export class AuthStorageAdapter implements Storage {
  get length(): number {
    return sessionStorage.length;
  }

  key(index: number): string | null {
    return sessionStorage.key(index);
  }

  getItem(key: string): string | null {
    if (isAuthStorageKey(key)) {
      // Inactivity guard (applies to all users)
      if (hasSessionExpiredDueToInactivity()) {
        console.log('⏰ Session expired due to 24h inactivity (detected in authStorage) - logging out');
        console.log(`📊 Last activity: ${getTimeSinceLastActivity()}`);
        _inactivityLogoutFromStorage = true;
        // Rensa ASYNKRONT: en läsning ska aldrig mutera lagringen mitt i
        // GoTrue:s init-flöde (det kunde ge halvrensad session och
        // inloggningsproblem). Vi returnerar null direkt och städar efteråt.
        setTimeout(() => {
          try {
            this.clearAuthData();
            clearActivityTracking();
          } catch {}
        }, 0);
        return null;
      }


      // 1. Primary: per-tab sessionStorage
      let value: string | null = null;
      try { value = sessionStorage.getItem(key); } catch {}
      if (value) return value;

      // 2. Fallback: Remember Me snapshot in localStorage (renamed key —
      //    Supabase does NOT watch this key, so it won't trigger cross-tab sync).
      if (shouldRememberUser()) {
        const snap = readLocal(snapshotKey(key));
        if (snap) {
          // Hydrate sessionStorage so subsequent reads are fast and
          // Supabase's normal flow continues from sessionStorage only.
          try { sessionStorage.setItem(key, snap); } catch {}
          return snap;
        }
      }

      // 3. Legacy migration: previous versions stored auth tokens directly in
      //    localStorage under the original Supabase key. If we find one, move
      //    it into our new locations and delete the old copy so we never
      //    trigger cross-tab storage events again.
      try {
        const legacy = localStorage.getItem(key);
        if (legacy) {
          try { sessionStorage.setItem(key, legacy); } catch {}
          if (shouldRememberUser()) {
            writeLocal(snapshotKey(key), legacy);
          }
          try { localStorage.removeItem(key); } catch {}
          return legacy;
        }
      } catch {}

      return null;
    }

    // Non-auth keys: read from sessionStorage as before.
    try { return sessionStorage.getItem(key); } catch { return null; }
  }

  setItem(key: string, value: string): void {
    if (isAuthStorageKey(key)) {
      // Primary: sessionStorage (per-tab)
      try {
        sessionStorage.setItem(key, value);
      } catch (ssError) {
        console.warn('Failed to write auth key to sessionStorage:', ssError);
      }

      // Snapshot in localStorage under renamed key — only if Remember Me is on.
      if (shouldRememberUser()) {
        writeLocal(snapshotKey(key), value);
      }

      updateLastActivity();
    } else {
      try { sessionStorage.setItem(key, value); } catch {}
    }
  }


  removeItem(key: string): void {
    // Per-tab logout: clear from sessionStorage in this tab only.
    try { sessionStorage.removeItem(key); } catch {}

    // Also clear the snapshot so this tab's logout fully forgets the user
    // for future new tabs. Other tabs that are still logged in will rewrite
    // the snapshot on their next token refresh (since they continue running).
    if (isAuthStorageKey(key)) {
      removeLocal(snapshotKey(key));
      // Belt-and-suspenders: also remove any leftover legacy entry.
      removeLocal(key);
    }

  }

  clear(): void {
    // Only clear auth-related items.
    this.clearAuthData();
  }

  private clearAuthData(): void {
    // sessionStorage: remove only this tab's auth keys
    const sessionKeysToRemove: string[] = [];
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && isAuthStorageKey(key)) sessionKeysToRemove.push(key);
      }
    } catch {}
    sessionKeysToRemove.forEach((key) => {
      try { sessionStorage.removeItem(key); } catch {}
    });

    // localStorage: remove snapshots and any legacy entries (this fully
    // forgets the user for future new tabs from this device).
    const localKeysToRemove: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.startsWith(SNAPSHOT_PREFIX) || isAuthStorageKey(key)) {
          localKeysToRemove.push(key);
        }
      }
    } catch {}
    localKeysToRemove.forEach((key) => removeLocal(key));

    // Spegeln (används när localStorage är blockerat) måste också rensas.
    Array.from(memoryMirror.keys())
      .filter((k) => k.startsWith(SNAPSHOT_PREFIX) || isAuthStorageKey(k))
      .forEach((k) => memoryMirror.delete(k));

  }
}

// Singleton instance
export const authStorage = new AuthStorageAdapter();
