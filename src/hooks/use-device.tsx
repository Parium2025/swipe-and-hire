import { useEffect, useState } from 'react';

// Mobile breakpoint - below this we use mobile layout with sidebar
const MOBILE_BREAKPOINT = 768;

export type DeviceType = 'mobile' | 'desktop';

function getDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  // All devices >= 768px with pointer get desktop top nav (no sidebar)
  if (width < MOBILE_BREAKPOINT) return 'mobile';
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
