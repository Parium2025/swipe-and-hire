import React from 'react';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { cn } from '@/lib/utils';

interface OptimizedContainerProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'centered' | 'fullscreen';
  padding?: 'none' | 'small' | 'medium' | 'large';
}

export const OptimizedContainer: React.FC<OptimizedContainerProps> = ({ 
  children, 
  className,
  variant = 'default',
  padding = 'medium'
}) => {
  const layout = useResponsiveLayout();

  const getVariantClasses = () => {
    switch (variant) {
      case 'centered':
        return layout.contentClasses;
      case 'fullscreen':
        return 'min-h-screen flex flex-col justify-center items-center p-4';
      default:
        return layout.containerClasses;
    }
  };

  const getPaddingClasses = () => {
    switch (padding) {
      case 'none':
        return 'p-0';
      case 'small':
        return 'p-2 md:p-4';
      case 'large':
        return 'p-8 md:p-12';
      default:
        return 'p-4 md:p-6 lg:p-8';
    }
  };

  return (
    <div className={cn(
      'bg-parium-gradient',
      getVariantClasses(),
      getPaddingClasses(),
      className
    )}>
      {children}
    </div>
  );
};

export default OptimizedContainer;