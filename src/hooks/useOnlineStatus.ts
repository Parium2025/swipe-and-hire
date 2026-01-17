import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { toast } from 'sonner';

// Global state för forcerad offline (för dev/test)
let forceOfflineMode = false;
let forceOfflineListeners: Set<() => void> = new Set();

export const setForceOfflineMode = (enabled: boolean) => {
  forceOfflineMode = enabled;
  forceOfflineListeners.forEach(listener => listener());
};

export const getForceOfflineMode = () => forceOfflineMode;

/**
 * Hook för att övervaka online/offline status
 */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine && !forceOfflineMode);

  useEffect(() => {
    const updateStatus = () => {
      setIsOnline(navigator.onLine && !forceOfflineMode);
    };

    const handleOnline = () => {
      console.log('📡 Online');
      updateStatus();
    };

    const handleOffline = () => {
      console.log('🔌 Offline');
      updateStatus();
    };

    // Lyssna på force offline changes
    forceOfflineListeners.add(updateStatus);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      forceOfflineListeners.delete(updateStatus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

/**
 * Context för att dela online-status och offline-toast globalt
 */
export interface OnlineContextValue {
  isOnline: boolean;
  showOfflineToast: () => void;
  requireOnline: (callback: () => void) => void;
}

export const OnlineContext = createContext<OnlineContextValue | null>(null);

/**
 * Hook för att använda online-context med fallback
 */
export const useOnline = (): OnlineContextValue => {
  const context = useContext(OnlineContext);
  const fallbackIsOnline = useOnlineStatus();
  
  if (context) {
    return context;
  }
  
  // Fallback om providern inte finns (bakåtkompatibilitet)
  return {
    isOnline: fallbackIsOnline,
    showOfflineToast: () => {
      toast.error('Ingen anslutning', {
        description: 'Kontrollera din internetanslutning och försök igen',
        duration: 3000,
      });
    },
    requireOnline: (callback: () => void) => {
      if (fallbackIsOnline) {
        callback();
      } else {
        toast.error('Ingen anslutning');
      }
    },
  };
};

/**
 * Hook för forcerad offline-läge (dev tools)
 */
export const useForceOffline = () => {
  const [isForced, setIsForced] = useState(forceOfflineMode);

  useEffect(() => {
    const updateState = () => setIsForced(forceOfflineMode);
    forceOfflineListeners.add(updateState);
    return () => { forceOfflineListeners.delete(updateState); };
  }, []);

  const toggle = useCallback((enabled: boolean) => {
    setForceOfflineMode(enabled);
    setIsForced(enabled);
  }, []);

  return { isForced, toggle };
};

/**
 * Utility-funktion för att få disabled-state baserat på online-status
 */
export const useOfflineDisabled = (additionalDisabled = false) => {
  const { isOnline, showOfflineToast } = useOnline();
  
  return {
    isDisabled: !isOnline || additionalDisabled,
    isOffline: !isOnline,
    onDisabledClick: showOfflineToast,
  };
};
