import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WifiOff, Loader2, Check } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { getLatestDraftTime } from '@/lib/draftUtils';
import { forceConnectivityCheck } from '@/lib/connectivityManager';

export const OfflineIndicator = () => {
  const isOnline = useOnlineStatus();
  const [showReconnecting, setShowReconnecting] = useState(false);
  const [secondsOffline, setSecondsOffline] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [draftTime, setDraftTime] = useState<string | null>(null);
  const wasOnlineRef = useRef(true);
  const showDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hämta senaste draft-tid när vi går offline
  useEffect(() => {
    if (!isOnline) {
      const time = getLatestDraftTime();
      setDraftTime(time);
    }
  }, [isOnline]);

  // Hantera fade in/out animation
  useEffect(() => {
    if (!isOnline) {
      if (showDelayTimerRef.current) clearTimeout(showDelayTimerRef.current);
      showDelayTimerRef.current = setTimeout(() => {
        setShouldRender(true);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsVisible(true);
          });
        });
      }, 900);
      wasOnlineRef.current = false;
    } else if (!wasOnlineRef.current) {
      if (showDelayTimerRef.current) {
        clearTimeout(showDelayTimerRef.current);
        showDelayTimerRef.current = null;
      }
      // Kom tillbaka online - fade ut
      setIsVisible(false);
      // Vänta på animation innan vi tar bort från DOM
      const timer = setTimeout(() => {
        setShouldRender(false);
        setSecondsOffline(0);
        setShowReconnecting(false);
        setDraftTime(null);
      }, 300);
      wasOnlineRef.current = true;
      return () => clearTimeout(timer);
    }

    return () => {
      if (showDelayTimerRef.current) {
        clearTimeout(showDelayTimerRef.current);
        showDelayTimerRef.current = null;
      }
    };
  }, [isOnline]);

  // Räkna sekunder offline och visa "Återansluter..." efter 10 sekunder
  useEffect(() => {
    if (!isOnline) {
      void forceConnectivityCheck();

      const timer = setInterval(() => {
        void forceConnectivityCheck();

        setSecondsOffline(prev => {
          const newVal = prev + 1;
          if (newVal >= 10) {
            setShowReconnecting(true);
          }
          return newVal;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [isOnline]);

  if (!shouldRender) {
    return null;
  }

  // Bygg meddelande med draft-tid om tillgänglig
  const getMessage = () => {
    const draftSuffix = draftTime ? ` – sparat ${draftTime}` : '';
    
    if (showReconnecting) {
      return `Återansluter...${draftSuffix}`;
    }
    if (draftTime) {
      return `Offline – dina ändringar är sparade (${draftTime})`;
    }
    return 'Offline – visar sparad data';
  };

  return (
    <div 
      className={`fixed left-0 right-0 z-40 px-4 transition-all duration-300 ease-out ${
        isVisible 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 -translate-y-2'
      }`}
      style={{ top: '3.5rem' }} // Under headern (h-14 = 3.5rem)
    >
      <Alert className="border-white/20 bg-slate-900/90 backdrop-blur-xl text-white shadow-lg">
        <div className="flex items-center justify-center gap-2">
          {showReconnecting ? (
            <Loader2 className="h-4 w-4 animate-spin text-white" />
          ) : (
            <WifiOff className="h-4 w-4 text-white" />
          )}
          <AlertDescription className="text-center font-medium text-white">
            {getMessage()}
          </AlertDescription>
        </div>
      </Alert>
    </div>
  );
};
