import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.parium.swipehire',
  appName: 'swipe-and-hire',
  webDir: 'dist',
  server: {
    url: 'https://09c4e686-17a9-467e-89b1-3cf832371d49.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
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