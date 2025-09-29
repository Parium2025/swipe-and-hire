import { useState, useEffect } from 'react';
import { useDeviceDetection } from './useDeviceDetection';

interface ResponsiveLayout {
  containerClasses: string;
  contentClasses: string;
  headerClasses: string;
  spacingClasses: string;
  buttonClasses: string;
  inputClasses: string;
  cardClasses: string;
  textClasses: string;
}

export const useResponsiveLayout = (): ResponsiveLayout => {
  const deviceInfo = useDeviceDetection();
  const [layout, setLayout] = useState<ResponsiveLayout>({
    containerClasses: '',
    contentClasses: '',
    headerClasses: '',
    spacingClasses: '',
    buttonClasses: '',
    inputClasses: '',
    cardClasses: '',
    textClasses: ''
  });

  useEffect(() => {
    // Lovable-inspired responsive layout system
    const getOptimizedLayout = (): ResponsiveLayout => {
      if (deviceInfo.isMobile) {
        return {
          // Mobile-first containers - like Lovable
          containerClasses: 'min-h-screen flex flex-col px-4 py-6 max-w-sm mx-auto',
          
          // Perfectly centered content areas
          contentClasses: 'flex-1 flex flex-col justify-center items-center space-y-8 text-center',
          
          // Mobile-optimized headers
          headerClasses: 'w-full flex items-center justify-between py-4 px-2',
          
          // Generous spacing like Lovable
          spacingClasses: 'space-y-8',
          
          // Touch-friendly buttons
          buttonClasses: 'w-full h-12 text-base font-medium rounded-xl shadow-lg active:scale-98 transition-all duration-200',
          
          // Optimized inputs
          inputClasses: 'w-full h-12 text-base px-4 rounded-xl border-2 focus:ring-4 focus:ring-primary/20 transition-all duration-200',
          
          // Beautiful cards
          cardClasses: 'w-full p-6 rounded-2xl shadow-xl backdrop-blur-sm border border-white/10',
          
          // Perfect typography
          textClasses: 'text-base leading-relaxed text-center'
        };
      } else if (deviceInfo.isTablet) {
        return {
          containerClasses: 'min-h-screen flex flex-col px-8 py-8 max-w-2xl mx-auto',
          contentClasses: 'flex-1 flex flex-col justify-center items-center space-y-10 text-center',
          headerClasses: 'w-full flex items-center justify-between py-6 px-4',
          spacingClasses: 'space-y-10',
          buttonClasses: 'w-full max-w-md h-14 text-lg font-medium rounded-xl shadow-lg hover:scale-105 transition-all duration-300',
          inputClasses: 'w-full max-w-md h-14 text-lg px-6 rounded-xl border-2 focus:ring-4 focus:ring-primary/20 transition-all duration-200',
          cardClasses: 'w-full max-w-md p-8 rounded-2xl shadow-xl backdrop-blur-sm border border-white/10',
          textClasses: 'text-lg leading-relaxed text-center'
        };
      } else {
        // Desktop - inspired by Lovable's clean layout
        return {
          containerClasses: 'min-h-screen flex flex-col px-12 py-12 max-w-4xl mx-auto',
          contentClasses: 'flex-1 flex flex-col justify-center items-center space-y-12 text-center',
          headerClasses: 'w-full flex items-center justify-between py-8 px-6',
          spacingClasses: 'space-y-12',
          buttonClasses: 'px-8 py-4 text-lg font-medium rounded-xl shadow-lg hover:scale-105 transition-all duration-300',
          inputClasses: 'px-6 py-4 text-lg rounded-xl border-2 focus:ring-4 focus:ring-primary/20 transition-all duration-200',
          cardClasses: 'p-10 rounded-2xl shadow-xl backdrop-blur-sm border border-white/10',
          textClasses: 'text-xl leading-relaxed text-center'
        };
      }
    };

    setLayout(getOptimizedLayout());
  }, [deviceInfo]);

  return layout;
};

export default useResponsiveLayout;