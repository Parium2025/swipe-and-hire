import { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

export const useStatusBar = () => {
  useEffect(() => {
    const setupStatusBar = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          // Sätt statusbarens stil till mörk text på ljus bakgrund
          await StatusBar.setStyle({ style: Style.Dark });
          
          // Sätt statusbarens bakgrundsfärg till Parium navy blue
          await StatusBar.setBackgroundColor({ color: '#1a365d' });
          
          // Gör så statusbaren inte överlappar innehållet
          await StatusBar.setOverlaysWebView({ overlay: false });
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