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
      style: 'dark',
      backgroundColor: '#1a365d', // Parium navy blue
      overlaysWebView: false
    }
  }
};

export default config;