import React, { useEffect } from 'react';
import { useDeviceDetection } from '@/hooks/useDeviceDetection';

interface AutoResponsiveWrapperProps {
  children: React.ReactNode;
}

export const AutoResponsiveWrapper: React.FC<AutoResponsiveWrapperProps> = ({ children }) => {
  const deviceInfo = useDeviceDetection();

  useEffect(() => {
    // Auto-apply responsive classes based on device
    const applyResponsiveStyles = () => {
      const root = document.documentElement;
      
      // Remove all device classes first
      root.classList.remove('is-mobile', 'is-tablet', 'is-desktop', 'has-notch');
      
      // Apply device-specific classes
      if (deviceInfo.isMobile) {
        root.classList.add('is-mobile');
        
        // Apply mobile-specific optimizations
        root.style.setProperty('--input-height', '3.5rem'); // 56px - touch friendly
        root.style.setProperty('--button-height', '3.5rem');
        root.style.setProperty('--spacing', '2rem');
        root.style.setProperty('--text-size', '1rem');
        root.style.setProperty('--border-radius', '1rem');
        
      } else if (deviceInfo.isTablet) {
        root.classList.add('is-tablet');
        
        root.style.setProperty('--input-height', '3.75rem'); // 60px
        root.style.setProperty('--button-height', '3.75rem');
        root.style.setProperty('--spacing', '2.5rem');
        root.style.setProperty('--text-size', '1.125rem');
        root.style.setProperty('--border-radius', '1.25rem');
        
      } else {
        root.classList.add('is-desktop');
        
        root.style.setProperty('--input-height', '2.75rem'); // 44px
        root.style.setProperty('--button-height', '2.75rem');
        root.style.setProperty('--spacing', '1.5rem');
        root.style.setProperty('--text-size', '0.875rem');
        root.style.setProperty('--border-radius', '0.5rem');
      }
      
      // Check for notch/dynamic island
      if (deviceInfo.hasNotch || deviceInfo.hasDynamicIsland) {
        root.classList.add('has-notch');
      }
    };

    applyResponsiveStyles();
    
    // Re-apply on window resize
    window.addEventListener('resize', applyResponsiveStyles);
    
    return () => {
      window.removeEventListener('resize', applyResponsiveStyles);
    };
  }, [deviceInfo]);

  return <>{children}</>;
};

export default AutoResponsiveWrapper;
