import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WifiOff, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

export const OfflineIndicator = () => {
  const isOnline = useOnlineStatus();
  const [showReconnecting, setShowReconnecting] = useState(false);
  const [secondsOffline, setSecondsOffline] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const wasOnlineRef = useRef(true);

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

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-50 px-4 pt-4 transition-all duration-300 ease-out ${
        isVisible 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 -translate-y-2'
      }`}
    >
      <Alert className="border-white/20 bg-slate-900/90 backdrop-blur-xl text-white shadow-lg">
        <div className="flex items-center justify-center gap-2">
          {showReconnecting ? (
            <Loader2 className="h-4 w-4 animate-spin text-white" />
          ) : (
            <WifiOff className="h-4 w-4 text-white" />
          )}
          <AlertDescription className="text-center font-medium text-white">
            {showReconnecting 
              ? 'Återansluter...' 
              : 'Offline - visar sparad data'
            }
          </AlertDescription>
        </div>
      </Alert>
    </div>
  );
};
