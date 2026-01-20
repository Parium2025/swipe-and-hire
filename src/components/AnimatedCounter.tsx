import { useEffect, useRef, useState, memo } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
}

export const AnimatedCounter = memo(({ 
  value, 
  duration = 500,
  className = ''
}: AnimatedCounterProps) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);
  const previousValue = useRef(value);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = previousValue.current;
    const endValue = value;
    
    // Detect direction of change
    if (endValue > startValue) {
      setDirection('up');
    } else if (endValue < startValue) {
      setDirection('down');
    }
    
    // Clear direction indicator after animation
    const directionTimeout = setTimeout(() => {
      setDirection(null);
    }, 1500);

    // If no change, skip animation
    if (startValue === endValue) {
      return () => clearTimeout(directionTimeout);
    }

    const startTime = performance.now();
    const difference = endValue - startValue;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      
      const currentValue = Math.round(startValue + difference * easeOutQuart);
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        previousValue.current = endValue;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      clearTimeout(directionTimeout);
    };
  }, [value, duration]);

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="tabular-nums">{displayValue}</span>
      {direction === 'up' && (
        <ArrowUp 
          className="h-3 w-3 md:h-4 md:w-4 text-green-400 animate-fade-in" 
          strokeWidth={3}
        />
      )}
      {direction === 'down' && (
        <ArrowDown 
          className="h-3 w-3 md:h-4 md:w-4 text-red-400 animate-fade-in" 
          strokeWidth={3}
        />
      )}
    </span>
  );
});

AnimatedCounter.displayName = 'AnimatedCounter';
