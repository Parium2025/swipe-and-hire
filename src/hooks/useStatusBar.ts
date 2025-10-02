// Utility helpers for Capacitor StatusBar with safe runtime checks (no React hooks)

export const useStatusBar = () => {
  const setupStatusBar = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor) {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          // Enable overlay mode så status bar blir transparent och ligger över innehållet
          await StatusBar.setOverlaysWebView({ overlay: true });
          
          // Sätt ljus text (för mörk blur-bakgrund)
          await StatusBar.setStyle({ style: Style.Light });
          
          // Visa status bar
          await StatusBar.show();
        }
      }
    } catch (error) {
      // Gracefully handle if Capacitor modules aren't available
      console.log('StatusBar configuration not available:', error);
    }
  };

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