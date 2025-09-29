import React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface OptimizedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  // No need for optimized prop anymore - it's always automatic
}

export const OptimizedInput: React.FC<OptimizedInputProps> = ({ 
  className,
  style,
  ...props 
}) => {
  return (
    <Input
      className={cn(className)}
      style={{
        minHeight: 'var(--optimized-input-height)',
        ...style
      }}
      {...props}
    />
  );
};

export default OptimizedInput;