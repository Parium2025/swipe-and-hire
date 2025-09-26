import { useEffect } from 'react';

export const useStatusBar = () => {
  useEffect(() => {
    const setupStatusBar = async () => {
      // Only try to import Capacitor modules if we're in a native environment
      try {
        if (typeof window !== 'undefined' && (window as any).Capacitor) {
          const { StatusBar } = await import('@capacitor/status-bar');
          const { Capacitor } = await import('@capacitor/core');
          
          if (Capacitor.isNativePlatform()) {
            // Dölj statusbaren helt för fullskärmsupplevelse
            await StatusBar.hide();
          }
        }
      } catch (error) {
        // Gracefully handle if Capacitor modules aren't available
        console.log('StatusBar configuration not available:', error);
      }
    };

    setupStatusBar();
  }, []);

  const hideStatusBar = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor) {
        const { StatusBar } = await import('@capacitor/status-bar');
        const { Capacitor } = await import('@capacitor/core');
        
        if (Capacitor.isNativePlatform()) {
          await StatusBar.hide();
        }
      }
    } catch (error) {
      console.log('Could not hide status bar:', error);
    }
  };

  const showStatusBar = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor) {
        const { StatusBar } = await import('@capacitor/status-bar');
        const { Capacitor } = await import('@capacitor/core');
        
        if (Capacitor.isNativePlatform()) {
          await StatusBar.show();
        }
      }
    } catch (error) {
      console.log('Could not show status bar:', error);
    }
  };

  return { hideStatusBar, showStatusBar };
};