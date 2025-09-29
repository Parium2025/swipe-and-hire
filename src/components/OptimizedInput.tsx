import React from 'react';
import { Input } from '@/components/ui/input';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { cn } from '@/lib/utils';

interface OptimizedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  optimized?: boolean;
}

export const OptimizedInput: React.FC<OptimizedInputProps> = ({ 
  className,
  optimized = true,
  ...props 
}) => {
  const layout = useResponsiveLayout();

  return (
    <Input
      className={cn(
        optimized && layout.inputClasses,
        className
      )}
      {...props}
    />
  );
};

export default OptimizedInput;