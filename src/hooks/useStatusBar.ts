// Utility helpers for Capacitor StatusBar with safe runtime checks (no React hooks)

export const useStatusBar = () => {
  const setupStatusBar = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor) {
        const { StatusBar } = await import('@capacitor/status-bar');
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          // Set status bar to match Parium blue gradient background
          await StatusBar.setBackgroundColor({ color: '#1d3a60' });
          await StatusBar.setStyle({ style: 'LIGHT' as any });
          await StatusBar.show();
        }
      }
    } catch (error) {
      // Gracefully handle if Capacitor modules aren't available
      console.log('StatusBar configuration not available:', error);
    }
  };

  // Consumers can call this manually when needed instead of on mount
  // setupStatusBar(); // intentionally NOT auto-invoked to avoid hook-related issues

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

  return { setupStatusBar, hideStatusBar, showStatusBar };
};