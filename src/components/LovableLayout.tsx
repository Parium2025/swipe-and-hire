import React from 'react';
import { useDeviceDetection } from '@/hooks/useDeviceDetection';
import { cn } from '@/lib/utils';

interface LovableLayoutProps {
  children: React.ReactNode;
  className?: string;
  centered?: boolean;
  variant?: 'page' | 'dialog' | 'card';
}

export const LovableLayout: React.FC<LovableLayoutProps> = ({ 
  children, 
  className,
  centered = true,
  variant = 'page'
}) => {
  const deviceInfo = useDeviceDetection();

  const getLayoutClasses = () => {
    const baseClasses = 'w-full';
    
    if (variant === 'dialog') {
      return cn(
        baseClasses,
        centered && 'lovable-center',
        'lovable-content',
        className
      );
    }
    
    if (variant === 'card') {
      return cn(
        baseClasses,
        'lovable-card',
        className
      );
    }
    
    // Default page layout
    return cn(
      baseClasses,
      centered && 'lovable-center',
      'lovable-content',
      className
    );
  };

  return (
    <div className={getLayoutClasses()}>
      {children}
    </div>
  );
};

export default LovableLayout;