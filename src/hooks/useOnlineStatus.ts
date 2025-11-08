import { useState, useEffect } from 'react';

/**
 * Hook för att övervaka online/offline status
 */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      console.log('📡 Online');
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.log('🔌 Offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};
