import React from 'react';
import { Card } from '@/components/ui/card';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { cn } from '@/lib/utils';

interface OptimizedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  optimized?: boolean;
  glassEffect?: boolean;
}

export const OptimizedCard: React.FC<OptimizedCardProps> = ({ 
  children,
  className,
  optimized = true,
  glassEffect = false,
  ...props 
}) => {
  const layout = useResponsiveLayout();

  return (
    <Card
      className={cn(
        optimized && layout.cardClasses,
        glassEffect && 'bg-white/5 backdrop-blur-lg border-white/20',
        className
      )}
      {...props}
    >
      {children}
    </Card>
  );
};

export default OptimizedCard;