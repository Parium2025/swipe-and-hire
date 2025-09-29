import { useEffect, useState } from 'react';

// Enhanced device detection with detailed capabilities
export const useDeviceDetection = () => {
  const [deviceInfo, setDeviceInfo] = useState({
    type: 'desktop' as 'mobile' | 'tablet' | 'desktop',
    os: 'unknown' as 'ios' | 'android' | 'windows' | 'mac' | 'linux' | 'unknown',
    hasNotch: false,
    hasDynamicIsland: false,
    safeAreaTop: 0,
    safeAreaBottom: 0,
    screenWidth: 0,
    screenHeight: 0,
    isPortrait: true,
  });

  useEffect(() => {
    const detectDevice = () => {
      const ua = navigator.userAgent;
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Detect OS
      let os: typeof deviceInfo.os = 'unknown';
      if (/iPad|iPhone|iPod/.test(ua)) os = 'ios';
      else if (/Android/.test(ua)) os = 'android';
      else if (/Windows/.test(ua)) os = 'windows';
      else if (/Mac/.test(ua)) os = 'mac';
      else if (/Linux/.test(ua)) os = 'linux';

      // Detect device type
      let type: typeof deviceInfo.type = 'desktop';
      if (width < 768) type = 'mobile';
      else if (width < 1024) type = 'tablet';

      // Detect iPhone notch/Dynamic Island
      const hasNotch = os === 'ios' && window.screen.height >= 812; // iPhone X and newer
      const hasDynamicIsland = os === 'ios' && window.screen.height >= 852; // iPhone 14 Pro and newer

      // Get safe area insets
      const computedStyle = getComputedStyle(document.documentElement);
      const safeAreaTop = parseInt(computedStyle.getPropertyValue('env(safe-area-inset-top)') || '0');
      const safeAreaBottom = parseInt(computedStyle.getPropertyValue('env(safe-area-inset-bottom)') || '0');

      setDeviceInfo({
        type,
        os,
        hasNotch,
        hasDynamicIsland,
        safeAreaTop: safeAreaTop || (hasNotch ? 44 : 0),
        safeAreaBottom: safeAreaBottom || (hasNotch ? 34 : 0),
        screenWidth: width,
        screenHeight: height,
        isPortrait: height > width,
      });
    };

    detectDevice();
    window.addEventListener('resize', detectDevice);
    window.addEventListener('orientationchange', detectDevice);

    return () => {
      window.removeEventListener('resize', detectDevice);
      window.removeEventListener('orientationchange', detectDevice);
    };
  }, []);

  // Helper functions
  const getHeaderHeight = () => {
    if (deviceInfo.type === 'mobile') {
      return 64 + deviceInfo.safeAreaTop; // 4rem + safe area
    }
    return 64; // 4rem standard
  };

  const getContentPadding = () => {
    return {
      paddingTop: deviceInfo.safeAreaTop || 0,
      paddingBottom: deviceInfo.safeAreaBottom || 0,
    };
  };

  const getDialogStyles = () => {
    if (deviceInfo.type === 'mobile') {
      return {
        maxHeight: `calc(100vh - ${deviceInfo.safeAreaTop + deviceInfo.safeAreaBottom}px)`,
        marginTop: deviceInfo.safeAreaTop,
        marginBottom: deviceInfo.safeAreaBottom,
      };
    }
    return {};
  };

  return {
    ...deviceInfo,
    getHeaderHeight,
    getContentPadding,
    getDialogStyles,
    isMobile: deviceInfo.type === 'mobile',
    isTablet: deviceInfo.type === 'tablet',
    isDesktop: deviceInfo.type === 'desktop',
    isIOS: deviceInfo.os === 'ios',
    isAndroid: deviceInfo.os === 'android',
  };
};
