import { useEffect, useRef, useState, memo } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  /** Unique key for persisting the last known value across page loads */
  cacheKey?: string;
}

// Helper to read/write cached values
const getCachedValue = (key: string): number | null => {
  try {
    const cached = localStorage.getItem(`counter_${key}`);
    return cached ? parseInt(cached, 10) : null;
  } catch {
    return null;
  }
};

const setCachedValue = (key: string, value: number): void => {
  try {
    localStorage.setItem(`counter_${key}`, value.toString());
  } catch {
    // Ignore storage errors
  }
};

export const AnimatedCounter = memo(({ 
  value, 
  duration = 500,
  className = '',
  cacheKey
}: AnimatedCounterProps) => {
  // If cacheKey is provided, use cached value as initial; otherwise use current value
  const cachedInitial = cacheKey ? getCachedValue(cacheKey) : null;
  const initialValue = cachedInitial !== null ? cachedInitial : value;
  
  const [displayValue, setDisplayValue] = useState(initialValue);
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);
  const previousValue = useRef(initialValue);
  const animationRef = useRef<number | null>(null);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    const startValue = previousValue.current;
    const endValue = value;
    
    // Detect direction of change - only show arrow if there's actual change
    const actualChange = endValue !== startValue;
    if (actualChange) {
      if (endValue > startValue) {
        setDirection('up');
      } else if (endValue < startValue) {
        setDirection('down');
      }
      
      // Cache the new value for next page load
      if (cacheKey) {
        setCachedValue(cacheKey, endValue);
      }
    }
    
    // Clear direction indicator after animation
    const directionTimeout = setTimeout(() => {
      setDirection(null);
    }, 1500);

    // If no change, just update display without animation
    if (!actualChange) {
      setDisplayValue(endValue);
      previousValue.current = endValue;
      return () => clearTimeout(directionTimeout);
    }

    hasAnimatedRef.current = true;
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
  }, [value, duration, cacheKey]);

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
