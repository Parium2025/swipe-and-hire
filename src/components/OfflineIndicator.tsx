import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WifiOff, Loader2, Check } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { getLatestDraftTime } from '@/lib/draftUtils';

export const OfflineIndicator = () => {
  const isOnline = useOnlineStatus();
  const [showReconnecting, setShowReconnecting] = useState(false);
  const [secondsOffline, setSecondsOffline] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [draftTime, setDraftTime] = useState<string | null>(null);
  const wasOnlineRef = useRef(true);

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
      // Gick offline - visa med fade in
      setShouldRender(true);
      // Liten delay för att trigga animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
      wasOnlineRef.current = false;
    } else if (!wasOnlineRef.current) {
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
  }, [isOnline]);

  // Räkna sekunder offline och visa "Återansluter..." efter 10 sekunder
  useEffect(() => {
    if (!isOnline) {
      const timer = setInterval(() => {
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
          ) : draftTime ? (
            <Check className="h-4 w-4 text-green-400" />
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
