import React from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface OptimizedButtonProps extends ButtonProps {
  fullWidth?: boolean;
  // No need for optimized prop anymore - it's always automatic
}

export const OptimizedButton: React.FC<OptimizedButtonProps> = ({ 
  children, 
  className,
  fullWidth = false,
  style,
  ...props 
}) => {
  return (
    <Button
      className={cn(
        fullWidth && 'w-full',
        className
      )}
      style={{
        minHeight: 'var(--optimized-button-height)',
        ...style
      }}
      {...props}
    >
      {children}
    </Button>
  );
};

export default OptimizedButton;