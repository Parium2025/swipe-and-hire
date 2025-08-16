import { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

export const useStatusBar = () => {
  useEffect(() => {
    const setupStatusBar = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          // Använd ljus text, transparent bakgrund och låt statusbaren överlappa webview
          await StatusBar.setStyle({ style: Style.Light });
          // iOS behandlar bakgrunden som transparent när overlay = true
          try { await StatusBar.setBackgroundColor({ color: '#00000000' }); } catch {}
          await StatusBar.setOverlaysWebView({ overlay: true });
        } catch (error) {
          console.log('StatusBar configuration failed:', error);
        }
      }
    };

    setupStatusBar();
  }, []);

  const hideStatusBar = async () => {
    if (Capacitor.isNativePlatform()) {
      await StatusBar.hide();
    }
  };

  const showStatusBar = async () => {
    if (Capacitor.isNativePlatform()) {
      await StatusBar.show();
    }
  };

  return { hideStatusBar, showStatusBar };
};