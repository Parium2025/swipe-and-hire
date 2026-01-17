import { useState, useEffect, useCallback, createContext, useContext, useRef, createElement } from 'react';
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
 * Hook för att övervaka online/offline status (utan toast - använd useOnlineStatusWithToast för det)
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
 * Hook för online-status MED återanslutnings-toast (endast för OnlineStatusProvider)
 */
export const useOnlineStatusWithToast = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine && !forceOfflineMode);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const updateStatus = (showReconnectToast = false) => {
      const newOnlineStatus = navigator.onLine && !forceOfflineMode;
      
      // Visa återanslutnings-toast om vi var offline och nu är online
      if (showReconnectToast && wasOfflineRef.current && newOnlineStatus) {
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
      }
      
      wasOfflineRef.current = !newOnlineStatus;
      setIsOnline(newOnlineStatus);
    };

    const handleOnline = () => {
      console.log('📡 Online');
      updateStatus(true);
    };

    const handleOffline = () => {
      console.log('🔌 Offline');
      updateStatus(false);
    };

    const handleForceOfflineChange = () => {
      const newOnlineStatus = navigator.onLine && !forceOfflineMode;
      
      if (wasOfflineRef.current && newOnlineStatus) {
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
      }
      
      wasOfflineRef.current = !newOnlineStatus;
      setIsOnline(newOnlineStatus);
    };

    forceOfflineListeners.add(handleForceOfflineChange);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      forceOfflineListeners.delete(handleForceOfflineChange);
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
