import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface OptimizedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glassEffect?: boolean;
  // No need for optimized prop anymore - it's always automatic
}

export const OptimizedCard: React.FC<OptimizedCardProps> = ({ 
  children,
  className,
  glassEffect = false,
  style,
  ...props 
}) => {
  return (
    <Card
      className={cn(
        glassEffect && 'bg-white/5 backdrop-blur-lg border-white/20',
        className
      )}
      style={{
        padding: 'var(--optimized-padding)',
        ...style
      }}
      {...props}
    >
      {children}
    </Card>
  );
};

export default OptimizedCard;