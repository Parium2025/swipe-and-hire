import { useState, useEffect, useCallback, createContext, useContext, useRef, createElement } from 'react';
import { toast } from 'sonner';
import { getIsOnline, onConnectivityChange } from '@/lib/connectivityManager';

// Global state för forcerad offline (för dev/test)
let forceOfflineMode = false;
let forceOfflineListeners: Set<() => void> = new Set();

export const setForceOfflineMode = (enabled: boolean) => {
  forceOfflineMode = enabled;
  forceOfflineListeners.forEach(listener => listener());
};

export const getForceOfflineMode = () => forceOfflineMode;

/**
 * Hook för att övervaka online/offline status (utan toast - använd useOnlineStatusWithToast för det)
 * Använder connectivityManager för riktigt connectivity-test (inte bara navigator.onLine)
 */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(getIsOnline() && !forceOfflineMode);

  useEffect(() => {
    // Lyssna på riktiga connectivity-ändringar (ping-baserat)
    const unsubConnectivity = onConnectivityChange((online) => {
      setIsOnline(online && !forceOfflineMode);
    });

    const handleForceChange = () => {
      setIsOnline(getIsOnline() && !forceOfflineMode);
    };
    forceOfflineListeners.add(handleForceChange);

    return () => {
      unsubConnectivity();
      forceOfflineListeners.delete(handleForceChange);
    };
  }, []);

  return isOnline;
};

/**
 * Hook för online-status MED återanslutnings-toast (endast för OnlineStatusProvider)
 */
export const useOnlineStatusWithToast = () => {
  const [isOnline, setIsOnline] = useState(getIsOnline() && !forceOfflineMode);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const showReconnectToast = () => {
      let reconnectToastId: string | number = '';
      const dismiss = () => toast.dismiss(reconnectToastId);

      const content = createElement(
        'div',
        {
          role: 'button',
          tabIndex: 0,
          className: 'w-full select-none cursor-pointer',
          onClick: dismiss,
          onTouchStart: dismiss,
          onKeyDown: (e: any) => {
            if (e.key === 'Enter' || e.key === ' ') dismiss();
          },
        },
        createElement('div', { className: 'font-medium leading-none' }, 'Ansluten igen'),
        createElement(
          'div',
          { className: 'mt-1 text-sm opacity-90' },
          'Du är nu online och kan fortsätta arbeta'
        )
      );

      reconnectToastId = toast.success(content, {
        duration: 3000,
        closeButton: false,
      });
    };

    const handleConnectivityChange = (online: boolean) => {
      const effectiveOnline = online && !forceOfflineMode;

      if (wasOfflineRef.current && effectiveOnline) {
        showReconnectToast();
      }

      wasOfflineRef.current = !effectiveOnline;
      setIsOnline(effectiveOnline);
    };

    const unsubConnectivity = onConnectivityChange(handleConnectivityChange);

    const handleForceChange = () => {
      const effectiveOnline = getIsOnline() && !forceOfflineMode;
      if (wasOfflineRef.current && effectiveOnline) {
        showReconnectToast();
      }
      wasOfflineRef.current = !effectiveOnline;
      setIsOnline(effectiveOnline);
    };
    forceOfflineListeners.add(handleForceChange);

    return () => {
      unsubConnectivity();
      forceOfflineListeners.delete(handleForceChange);
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
