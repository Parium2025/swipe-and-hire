import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

function getDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  if (width < MOBILE_BREAKPOINT) return 'mobile';
  if (width < TABLET_BREAKPOINT) return 'tablet';
  return 'desktop';
}

export function useDevice(): DeviceType {
  const [device, setDevice] = useState<DeviceType>(getDeviceType);

  useEffect(() => {
    const handleResize = () => {
      setDevice(getDeviceType());
    };

    // Listen to resize events
    window.addEventListener('resize', handleResize);
    
    // Also listen to orientation change for mobile devices
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return device;
}

// Non-reactive version for SSR or one-time checks
export function getDevice(): DeviceType {
  return getDeviceType();
}
