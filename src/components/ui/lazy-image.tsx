import { useState, useEffect, useRef, ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';

interface LazyImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Fallback for broken images */
  fallback?: string;
  /** Show skeleton while loading */
  showSkeleton?: boolean;
  /** Aspect ratio for skeleton (e.g., "16/9", "1/1", "4/3") */
  aspectRatio?: string;
  /** Root margin for intersection observer */
  rootMargin?: string;
}

/**
 * 🚀 PREMIUM LAZY IMAGE
 * 
 * Laddar bilder endast när de är synliga (IntersectionObserver).
 * Visar skeleton placeholder för att undvika layout shift.
 * Optimerad för touch/svagt internet.
 */
export function LazyImage({
  src,
  alt,
  className,
  fallback,
  showSkeleton = true,
  aspectRatio = '1/1',
  rootMargin = '200px',
  style,
  ...props
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Skip lazy loading if IntersectionObserver not supported
    if (!('IntersectionObserver' in window)) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [rootMargin]);

  // Handle image load
  const handleLoad = () => {
    setIsLoaded(true);
    setHasError(false);
  };

  // Handle image error
  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  const imageSrc = hasError && fallback ? fallback : src;
  const showSkeletonState = showSkeleton && !isLoaded && !hasError;

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden', className)}
      style={{ 
        aspectRatio: aspectRatio,
        contain: 'layout style paint', // CSS containment for performance
        ...style 
      }}
    >
      {/* Skeleton placeholder */}
      {showSkeletonState && (
        <Skeleton 
          className="absolute inset-0 w-full h-full" 
          style={{ aspectRatio }}
        />
      )}
      
      {/* Actual image - only render when in view */}
      {isInView && imageSrc && (
        <img
          ref={imgRef}
          src={imageSrc}
          alt={alt || ''}
          loading="lazy"
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0'
          )}
          style={{ 
            willChange: isLoaded ? 'auto' : 'opacity',
            // Prevent layout shifts
            aspectRatio: aspectRatio,
          }}
          {...props}
        />
      )}
    </div>
  );
}

/**
 * Avatar variant med cirkulär form
 */
export function LazyAvatar({
  className,
  size = 40,
  ...props
}: LazyImageProps & { size?: number }) {
  return (
    <LazyImage
      className={cn('rounded-full', className)}
      aspectRatio="1/1"
      style={{ width: size, height: size }}
      {...props}
    />
  );
}
