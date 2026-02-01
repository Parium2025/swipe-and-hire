import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * 🚀 OPTIMIZED AVATAR COMPONENT
 * 
 * Performance optimizations for touch/slow internet:
 * - Synchronous cache check to prevent fallback flash
 * - CSS containment for isolated repaints
 * - loading="lazy" for images below the fold
 * - Minimal re-renders with memoization
 */

interface AvatarContextValue {
  imageLoaded: boolean;
  setImageLoaded: (loaded: boolean) => void;
}

const AvatarContext = React.createContext<AvatarContextValue | null>(null);

const Avatar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  
  return (
    <AvatarContext.Provider value={{ imageLoaded, setImageLoaded }}>
      <div
        ref={ref}
        className={cn(
          "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
          className
        )}
        style={{ contain: 'layout style paint' }}
        {...props}
      >
        {children}
      </div>
    </AvatarContext.Provider>
  );
})
Avatar.displayName = "Avatar"

interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  onLoadingStatusChange?: (status: 'loading' | 'loaded' | 'error') => void;
}

const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, src, alt, onLoadingStatusChange, ...props }, ref) => {
    const context = React.useContext(AvatarContext);
    
    // Check if image is already in browser cache (synchronous check on mount)
    const isCached = React.useMemo(() => {
      if (!src || typeof document === 'undefined') return false;
      const img = new Image();
      img.src = src;
      return img.complete && img.naturalWidth > 0;
    }, [src]);
    
    const [status, setStatus] = React.useState<'loading' | 'loaded' | 'error'>(
      isCached ? 'loaded' : 'loading'
    );
    
    // Notify context immediately if cached
    React.useLayoutEffect(() => {
      if (isCached && context) {
        context.setImageLoaded(true);
      }
    }, [isCached, context]);
    
    // Reset state when src changes
    React.useEffect(() => {
      if (!src) {
        setStatus('error');
        context?.setImageLoaded(false);
        onLoadingStatusChange?.('error');
        return;
      }
      
      // Re-check cache on src change
      const img = new Image();
      img.src = src;
      if (img.complete && img.naturalWidth > 0) {
        setStatus('loaded');
        context?.setImageLoaded(true);
        onLoadingStatusChange?.('loaded');
      } else {
        setStatus('loading');
        context?.setImageLoaded(false);
        onLoadingStatusChange?.('loading');
      }
    }, [src, context, onLoadingStatusChange]);

    const handleLoad = React.useCallback(() => {
      setStatus('loaded');
      context?.setImageLoaded(true);
      onLoadingStatusChange?.('loaded');
    }, [context, onLoadingStatusChange]);
    
    const handleError = React.useCallback(() => {
      setStatus('error');
      context?.setImageLoaded(false);
      onLoadingStatusChange?.('error');
    }, [context, onLoadingStatusChange]);

    if (!src || status === 'error') {
      return null;
    }

    return (
      <img
        ref={ref}
        src={src}
        alt={alt || ''}
        loading="lazy"
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={cn("aspect-square h-full w-full object-cover", className)}
        style={{ contentVisibility: 'auto' }}
        data-state={status}
        {...props}
      />
    );
  }
);
AvatarImage.displayName = "AvatarImage"

interface AvatarFallbackProps extends React.HTMLAttributes<HTMLSpanElement> {
  delayMs?: number;
}

const AvatarFallback = React.forwardRef<HTMLSpanElement, AvatarFallbackProps>(
  ({ className, delayMs, children, ...props }, ref) => {
    const context = React.useContext(AvatarContext);
    const [showFallback, setShowFallback] = React.useState(!delayMs);
    
    // Delay showing fallback if delayMs is set
    React.useEffect(() => {
      if (delayMs && delayMs > 0) {
        const timeout = setTimeout(() => {
          setShowFallback(true);
        }, delayMs);
        return () => clearTimeout(timeout);
      }
    }, [delayMs]);
    
    // Don't show fallback if image is already loaded
    if (context?.imageLoaded) {
      return null;
    }
    
    // Don't show fallback until delay has passed
    if (!showFallback) {
      return null;
    }

    return (
      <span
        ref={ref}
        className={cn(
          "flex h-full w-full items-center justify-center rounded-full bg-muted",
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);
AvatarFallback.displayName = "AvatarFallback"

export { Avatar, AvatarImage, AvatarFallback }
