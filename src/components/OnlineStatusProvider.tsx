import { useCallback, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useOnlineStatusWithToast, OnlineContext, type OnlineContextValue } from '@/hooks/useOnlineStatus';
import { getLatestDraftTime } from '@/lib/draftUtils';

interface OnlineStatusProviderProps {
  children: ReactNode;
}

/**
 * Provider för online-status context (endast denna visar återanslutnings-toast)
 */
export function OnlineStatusProvider({ children }: OnlineStatusProviderProps) {
  const isOnline = useOnlineStatusWithToast();
  
  // Visa offline-toast med draft-tid om tillgänglig
  const showOfflineToast = useCallback(() => {
    const draftTime = getLatestDraftTime();
    const description = draftTime 
      ? `Dina ändringar är sparade (${draftTime}). Kontrollera din anslutning.`
      : 'Kontrollera din internetanslutning och försök igen';
    
    toast.error('Ingen anslutning', {
      description,
      duration: 4000,
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
