import React from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { cn } from '@/lib/utils';

interface OptimizedButtonProps extends ButtonProps {
  fullWidth?: boolean;
  optimized?: boolean;
}

export const OptimizedButton: React.FC<OptimizedButtonProps> = ({ 
  children, 
  className,
  fullWidth = false,
  optimized = true,
  ...props 
}) => {
  const layout = useResponsiveLayout();

  return (
    <Button
      className={cn(
        optimized && layout.buttonClasses,
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
};

export default OptimizedButton;