import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fredrikandits.swipehire',
  appName: 'swipe-and-hire',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    },
    StatusBar: {
      style: 'light',
      backgroundColor: 'transparent',
      overlaysWebView: true
    }
  }
};

export default config;