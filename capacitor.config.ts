import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.09c4e68617a9467e89b13cf832371d49',
  appName: 'swipe-and-hire',
  webDir: 'dist',
  server: {
    url: 'https://09c4e686-17a9-467e-89b1-3cf832371d49.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};

export default config;