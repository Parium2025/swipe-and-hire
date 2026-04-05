import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.parium.app',
  appName: 'Parium',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    },
    StatusBar: {
      style: 'light',
      backgroundColor: 'transparent',
      overlaysWebView: true
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  },
  ios: {
    allowsLinkPreview: false,
    scrollEnabled: true,
    overrideUserAgent: undefined,
    // Disable iOS swipe-back gesture so our sidebar edge-swipe works
    preferredContentMode: 'mobile',
    allowNavigation: []
  }
};

export default config;
