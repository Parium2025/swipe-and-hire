import { useCallback, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useOnlineStatus, OnlineContext, type OnlineContextValue } from '@/hooks/useOnlineStatus';

interface OnlineStatusProviderProps {
  children: ReactNode;
}

/**
 * Provider för online-status context
 */
export function OnlineStatusProvider({ children }: OnlineStatusProviderProps) {
  const isOnline = useOnlineStatus();
  
  // Visa offline-toast - matchar appens stil (vit text, mörk bakgrund)
  const showOfflineToast = useCallback(() => {
    toast.error('Ingen anslutning', {
      description: 'Kontrollera din internetanslutning och försök igen',
      duration: 3000,
    });
  }, []);
  
  // Wrapper som kör callback om online, annars visar toast
  const requireOnline = useCallback((callback: () => void) => {
    if (isOnline) {
      callback();
    } else {
      showOfflineToast();
    }
  }, [isOnline, showOfflineToast]);

  const value: OnlineContextValue = {
    isOnline,
    showOfflineToast,
    requireOnline,
  };

  return (
    <OnlineContext.Provider value={value}>
      {children}
    </OnlineContext.Provider>
  );
}
