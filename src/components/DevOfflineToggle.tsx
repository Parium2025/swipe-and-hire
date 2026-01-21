import { useState } from 'react';
import { WifiOff, Wifi, X } from 'lucide-react';
import { useForceOffline } from '@/hooks/useOnlineStatus';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

/**
 * Flytande dev-knapp för att toggla offline-läge var som helst i appen.
 * Endast synlig för dev-konton.
 */
export function DevOfflineToggle() {
  const { user, profile } = useAuth();
  const { isForced, toggle } = useForceOffline();
  const [minimized, setMinimized] = useState(false);

  // Visa endast för dev-konton
  const isDevAccount = user?.email?.toLowerCase().includes('parium') || 
                       user?.email?.toLowerCase().includes('@hp.com') ||
                       profile?.company_name?.toLowerCase().includes('parium');

  if (!isDevAccount) return null;

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className={`fixed bottom-20 right-4 z-50 p-3 rounded-full shadow-lg transition-all ${
          isForced 
            ? 'bg-red-500 text-white' 
            : 'bg-amber-500 text-white'
        }`}
        title="Öppna dev-panel"
      >
        {isForced ? <WifiOff className="h-5 w-5" /> : <Wifi className="h-5 w-5" />}
      </button>
    );
  }

  return (
    <div className={`fixed bottom-20 right-4 z-50 rounded-lg shadow-lg p-3 ${
      isForced 
        ? 'bg-red-500/90 backdrop-blur-sm border border-red-400' 
        : 'bg-amber-500/90 backdrop-blur-sm border border-amber-400'
    }`}>
      <div className="flex items-center gap-2">
        <button
          onClick={() => toggle(!isForced)}
          className="flex items-center gap-2 text-white text-sm font-medium"
        >
          {isForced ? (
            <>
              <WifiOff className="h-4 w-4" />
              <span>OFFLINE</span>
            </>
          ) : (
            <>
              <Wifi className="h-4 w-4" />
              <span>ONLINE</span>
            </>
          )}
        </button>
        <button
          onClick={() => setMinimized(true)}
          className="flex h-6 w-6 items-center justify-center rounded-full text-white bg-white/10 md:bg-transparent md:hover:bg-white/20 transition-colors ml-2"
          title="Minimera"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
