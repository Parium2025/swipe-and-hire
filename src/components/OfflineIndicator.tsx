import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WifiOff, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

export const OfflineIndicator = () => {
  const isOnline = useOnlineStatus();
  const [showReconnecting, setShowReconnecting] = useState(false);
  const [secondsOffline, setSecondsOffline] = useState(0);

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
    } else {
      setSecondsOffline(0);
      setShowReconnecting(false);
    }
  }, [isOnline]);

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-4">
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
