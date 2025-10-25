/**
 * Storage Optimizer - Improved localStorage handling with error recovery
 * 
 * Features:
 * - Quota checking before writes
 * - Automatic error handling and recovery
 * - sessionStorage fallback for temporary data
 * - Automatic cleanup of expired data
 */

interface StorageOptions {
  expiry?: number; // milliseconds
  useSession?: boolean; // use sessionStorage instead of localStorage
}

interface StorageData<T> {
  value: T;
  timestamp: number;
  expiry?: number;
}

export class StorageOptimizer {
  private static readonly QUOTA_WARNING_THRESHOLD = 0.8; // 80% of quota

  /**
   * Check if storage is available and has space
   */
  private static checkQuota(storage: Storage): boolean {
    try {
      // Check if storage is accessible
      const test = '__storage_test__';
      storage.setItem(test, test);
      storage.removeItem(test);

      // Check quota if available (not all browsers support this)
      if ('estimate' in navigator.storage) {
        navigator.storage.estimate().then(estimate => {
          if (estimate.usage && estimate.quota) {
            const usagePercent = estimate.usage / estimate.quota;
            if (usagePercent > this.QUOTA_WARNING_THRESHOLD) {
              console.warn(`Storage usage at ${Math.round(usagePercent * 100)}%`);
            }
          }
        });
      }

      return true;
    } catch (e) {
      console.error('Storage check failed:', e);
      return false;
    }
  }

  /**
   * Set item in storage with automatic error handling
   */
  static set<T>(
    key: string,
    value: T,
    options: StorageOptions = {}
  ): boolean {
    const { expiry, useSession = false } = options;
    const storage = useSession ? sessionStorage : localStorage;

    if (!this.checkQuota(storage)) {
      // Try to cleanup old data
      this.cleanup(storage);
      if (!this.checkQuota(storage)) {
        console.warn('Storage quota exceeded, skipping write');
        return false;
      }
    }

    try {
      const data: StorageData<T> = {
        value,
        timestamp: Date.now(),
        expiry,
      };
      storage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error(`Failed to write to storage (${key}):`, e);
      
      // If quota exceeded, try cleanup and retry once
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        this.cleanup(storage);
        try {
          const data: StorageData<T> = {
            value,
            timestamp: Date.now(),
            expiry,
          };
          storage.setItem(key, JSON.stringify(data));
          return true;
        } catch (retryError) {
          console.error('Retry failed:', retryError);
        }
      }
      return false;
    }
  }

  /**
   * Get item from storage with automatic expiry checking
   */
  static get<T>(key: string, useSession = false): T | null {
    const storage = useSession ? sessionStorage : localStorage;

    try {
      const raw = storage.getItem(key);
      if (!raw) return null;

      const data: StorageData<T> = JSON.parse(raw);
      
      // Check expiry
      if (data.expiry) {
        const age = Date.now() - data.timestamp;
        if (age > data.expiry) {
          storage.removeItem(key);
          return null;
        }
      }

      return data.value;
    } catch (e) {
      console.error(`Failed to read from storage (${key}):`, e);
      // Remove corrupted data
      try {
        storage.removeItem(key);
      } catch {}
      return null;
    }
  }

  /**
   * Remove item from storage
   */
  static remove(key: string, useSession = false): void {
    const storage = useSession ? sessionStorage : localStorage;
    try {
      storage.removeItem(key);
    } catch (e) {
      console.error(`Failed to remove from storage (${key}):`, e);
    }
  }

  /**
   * Cleanup expired items from storage
   */
  static cleanup(storage: Storage = localStorage): void {
    try {
      const now = Date.now();
      const keysToRemove: string[] = [];

      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key) continue;

        try {
          const raw = storage.getItem(key);
          if (!raw) continue;

          const data = JSON.parse(raw) as StorageData<unknown>;
          if (data.expiry && now - data.timestamp > data.expiry) {
            keysToRemove.push(key);
          }
        } catch {
          // Remove corrupted entries
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => {
        try {
          storage.removeItem(key);
        } catch {}
      });

      if (keysToRemove.length > 0) {
        console.log(`Cleaned up ${keysToRemove.length} expired/corrupted storage entries`);
      }
    } catch (e) {
      console.error('Storage cleanup failed:', e);
    }
  }

  /**
   * Clear all app-specific data (keeps browser data intact)
   */
  static clearAppData(prefix: string = 'parium'): void {
    try {
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch {}
      });
    } catch (e) {
      console.error('Clear app data failed:', e);
    }
  }
}

// Automatically cleanup on load (throttled to once per session)
if (typeof window !== 'undefined') {
  const cleanupKey = '__storage_cleanup_done__';
  if (!sessionStorage.getItem(cleanupKey)) {
    StorageOptimizer.cleanup(localStorage);
    sessionStorage.setItem(cleanupKey, 'true');
  }
}
