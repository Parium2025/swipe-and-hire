import { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

export const useStatusBar = () => {
  useEffect(() => {
    const setupStatusBar = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          // Dölj statusbaren helt för fullskärmsupplevelse
          await StatusBar.hide();
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