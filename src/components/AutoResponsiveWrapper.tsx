import React, { useEffect } from 'react';
import { useDeviceDetection } from '@/hooks/useDeviceDetection';

interface AutoResponsiveWrapperProps {
  children: React.ReactNode;
}

export const AutoResponsiveWrapper: React.FC<AutoResponsiveWrapperProps> = ({ children }) => {
  const deviceInfo = useDeviceDetection();

  useEffect(() => {
    // Auto-apply ONLY size optimizations based on device - NO design changes
    const applySizeOptimizations = () => {
      const root = document.documentElement;
      
      // Apply device-specific SIZE variables ONLY
      if (deviceInfo.isMobile) {
        // Mobile: Larger touch targets
        root.style.setProperty('--optimized-input-height', '3.5rem'); // 56px - touch friendly
        root.style.setProperty('--optimized-button-height', '3rem');
        root.style.setProperty('--optimized-spacing', '1rem');
        root.style.setProperty('--optimized-padding', '1.5rem');
        
      } else if (deviceInfo.isTablet) {
        // Tablet: Medium sizes
        root.style.setProperty('--optimized-input-height', '3rem'); // 48px
        root.style.setProperty('--optimized-button-height', '2.75rem');
        root.style.setProperty('--optimized-spacing', '0.875rem');
        root.style.setProperty('--optimized-padding', '1.25rem');
        
      } else {
        // Desktop: Compact sizes
        root.style.setProperty('--optimized-input-height', '2.5rem'); // 40px
        root.style.setProperty('--optimized-button-height', '2.5rem');
        root.style.setProperty('--optimized-spacing', '0.75rem');
        root.style.setProperty('--optimized-padding', '1rem');
      }
    };

    applySizeOptimizations();
    
    // Re-apply on window resize
    window.addEventListener('resize', applySizeOptimizations);
    
    return () => {
      window.removeEventListener('resize', applySizeOptimizations);
    };
  }, [deviceInfo]);

  return <>{children}</>;
};

export default AutoResponsiveWrapper;
