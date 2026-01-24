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
  // If cacheKey is provided, use cached value as starting point
  const cachedInitial = cacheKey ? getCachedValue(cacheKey) : null;
  const hasCachedValue = cachedInitial !== null;
  
  // If we have a cached value, use it as initial display value
  // This prevents showing 0 briefly before data loads
  const initialValue = hasCachedValue ? cachedInitial : value;
  
  const [displayValue, setDisplayValue] = useState(initialValue);
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);
  const previousValue = useRef(initialValue);
  const animationRef = useRef<number | null>(null);
  // Track if we've seen "real" data (non-zero value) since mount
  const hasReceivedRealData = useRef(false);

  useEffect(() => {
    const startValue = previousValue.current;
    const endValue = value;
    const actualChange = endValue !== startValue;
    
    // Ignore zero values - these indicate data is still loading
    // Don't cache 0 and don't animate from/to 0
    if (endValue === 0) {
      return;
    }
    
    // Mark that we've received real data
    const isFirstRealData = !hasReceivedRealData.current;
    hasReceivedRealData.current = true;
    
    // Cache the current value for next page load (only non-zero values)
    if (cacheKey) {
      setCachedValue(cacheKey, endValue);
    }
    
    // Show direction arrows ONLY if:
    // 1. We had a cached value before
    // 2. This is not the first time we're seeing real data
    // 3. The value actually changed from what we last showed
    const shouldShowArrow = hasCachedValue && !isFirstRealData && actualChange;
    
    if (shouldShowArrow) {
      if (endValue > startValue) {
        setDirection('up');
      } else if (endValue < startValue) {
        setDirection('down');
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

    // If this is the first real data we're seeing, just set it immediately
    if (isFirstRealData) {
      setDisplayValue(endValue);
      previousValue.current = endValue;
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
  }, [value, duration, cacheKey, hasCachedValue]);

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
